import { Injectable, Logger } from '@nestjs/common';
import { ActionType, CredentialKind, CredentialStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ComposioService } from '@/integrations/composio/composio.service';
import { SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { OnePasswordConnectService } from '@/integrations/password-managers/one-password-connect.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { randomToken, newId } from '@/shared/utils/security/crypto.utils';
import { hostMatchesDomain, normalizeWebsiteDomain, totpCode } from '@/shared/utils/security/website-login.utils';
import { AccessService } from '../../access/access.service';
import { ActivityService } from '../../activity/activity.service';
import { BotsService } from '../../bots/bots.service';
import { FilesService } from '../../files/files.service';
import { BROWSER_DEBUG_PORT, ComputersService, HOME, OPEN_BROWSER, OPEN_BROWSER_PATH, WORKSPACE } from '../../computers/computers.service';
import { SIGN_IN_SCRIPT, SIGN_IN_STEPS, SignInErrors, SignInField, SignInFields, SignInScriptInput, SignInScriptResult } from '../../computers/sign-in.script';
import { assertPublicUrl } from './web.utils';
import { obj, ToolContext, ToolDef, ToolResult } from './tool.types';

const TRANSFER_LIMIT = 1024 ** 3;
const MAX_FRAMES = 200;
const SIGN_IN_SCRIPT_PATH = `${HOME}/.agentspace/sign-in.cjs`;
const SIGN_IN_FIELDS: string[] = Object.values(SignInFields);

/** What a click or key press does on the website — the bot must say, so the approval engine can ask first (§9.3, §11). */
const EFFECTS = ['none', 'submit_form', 'send_message', 'post_publicly', 'purchase', 'delete'] as const;
export const EFFECT_ACTION: Record<string, ActionType | null> = {
    none: null,
    submit_form: 'EDIT_RECORDS',
    send_message: 'SEND_MESSAGE',
    post_publicly: 'POST_PUBLICLY',
    purchase: 'PURCHASE_PAYMENT',
    delete: 'DELETE_DATA',
};
export const effectParam = {
    type: 'string',
    enum: EFFECTS,
    description:
        'What this action does on the website. Use "submit_form" for submitting anything important (orders, applications, settings), "send_message" for sending emails/messages, "post_publicly" for publishing, "purchase" for payments, "delete" for deleting. Otherwise "none". Be honest — sensitive actions are shown to the user for approval first.',
};

/**
 * Tools for the bot's cloud computer (§9): shell, files, a real browser on a desktop (screenshots + mouse/keyboard),
 * copying files in from storage, URLs and connected services, and sharing results into the chat.
 */
@Injectable()
export class ComputerToolsService {
    private readonly logger = new Logger(ComputerToolsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly computers: ComputersService,
        private readonly files: FilesService,
        private readonly storage: StorageService,
        private readonly composio: ComposioService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly secrets: SecretStoreService,
        private readonly onePassword: OnePasswordConnectService,
        private readonly bots: BotsService,
    ) { }

    async tools(ctx: ToolContext): Promise<ToolDef[]> {
        if (!(await this.allowedForRun(ctx))) return [];
        if (!ctx.bot.cloud_computer_enabled) return (await this.mayTurnOn(ctx)) ? [this.turnOn(ctx)] : [];
        return [this.runCommand(), this.writeFile(), this.readFile(), this.listFiles(), this.copyTo(), this.copyFrom(), this.openUrl(), this.screenshot(), this.click(), this.type(), this.key(), this.scroll(), this.signIn(), this.askUser(), this.turnOff()];
    }

    /**
     * Whether this run may use a cloud computer at all (the bot's own switch is checked separately): the organisation
     * allows it for the acting user, and automation runs additionally need the automation's "uses cloud computer"
     * switch and the organisation's "automations may use the cloud computer" setting — all checked at run time, so
     * later changes apply (§9, §10).
     */
    private async allowedForRun(ctx: ToolContext): Promise<boolean> {
        if (!ctx.actor) return false;
        const s = ctx.org_settings;
        if (s && !s.cloud_computers_enabled) return false;
        if (s?.cloud_computers_who === 'OWNERS_ADMINS' && ctx.actor.role === 'MEMBER') return false;
        if (ctx.run.automation_run_id) {
            if (s && !s.automations_cloud_computer) return false;
            const ar = await this.prisma.automationRun.findUnique({ where: { id: ctx.run.automation_run_id }, select: { automation: { select: { uses_cloud_computer: true } } } });
            if (!ar?.automation.uses_cloud_computer) return false;
        }
        return true;
    }

    /** Switching the feature on for a bot is a bot setting, so only someone who may edit the bot (the acting user) can have the bot do it. */
    private async mayTurnOn(ctx: ToolContext): Promise<boolean> {
        try {
            await this.access.requireEditableBot(ctx.organization_id, ctx.actor!.user_id, ctx.bot.id);
            return true;
        } catch {
            return false;
        }
    }

    // ---------------- Turning the computer on and off ----------------

    /**
     * Lets a bot that has no cloud computer give itself one when a task needs it, so work (including automations that run
     * while the user is away) isn't blocked on someone visiting the bot's settings. In chat the user confirms first; an
     * automation the user already allowed to use the computer needs no extra confirmation.
     */
    private turnOn(ctx: ToolContext): ToolDef {
        return {
            name: 'computer_turn_on',
            description:
                'Turn on your own cloud computer (a private Linux desktop with a browser, Python and Node.js that keeps its files and website sign-ins). Use it when a task needs more than your other tools can do: building real .xlsx/.docx files, running scripts, browsing sites properly, or work an automation must do without the user\'s own computer being on. ' +
                'After it succeeds the computer_* tools are available straight away. In chat the user confirms first.',
            parameters: obj({ reason: { type: 'string', description: 'Why you need the computer, in one short sentence the user will read' } }, ['reason']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: !ctx.run.automation_run_id,
            title: () => 'Turning on my cloud computer',
            preview: async (a) => ({ title: 'Turn on cloud computer', action_type: 'OTHER', preview: { kind: 'change', target: ctx.bot.name, bot_id: ctx.bot.id, changes: [{ field: 'cloud_computer', to: 'On' }, { field: 'reason', to: String(a.reason ?? '').slice(0, 300) || 'The task needs it' }] } }),
            execute: async (_a, c) => {
                await this.bots.update(c.actor!, c.bot.id, { cloud_computer_enabled: true }, 'chat');
                // This run's tool list is rebuilt from the bot, so the computer tools appear without a new chat.
                c.bot.cloud_computer_enabled = true;
                return { output: { turned_on: true, note: 'Your cloud computer is on. It starts the first time you use a computer_* tool (about a minute). Continue with the task using those tools.' } };
            },
        };
    }

    /** Pauses the computer to stop it running (and being billed) once the work is done; files and sign-ins are kept and the next use resumes it. */
    private turnOff(): ToolDef {
        return {
            name: 'computer_turn_off',
            description: 'Turn off (pause) your cloud computer when you have finished using it, so it stops running. Files and website sign-ins are kept; it switches back on by itself the next time you use a computer_* tool. Share any results you want to keep with copy_from_computer first.',
            parameters: obj({}),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: () => 'Turning off my cloud computer',
            execute: async (_a, ctx) => {
                const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: ctx.bot.id } });
                if (!c?.daytona_sandbox_id || c.status !== 'RUNNING') return { output: { turned_off: true, note: 'The computer was not running.' } };
                const controller = await this.computers.controllerOf(c.id);
                if (controller) throw new Error(`${controller.name ?? 'A person'} is using the computer right now, so it was left on.`);
                await this.computers.pause(ctx.actor!, ctx.bot.id);
                return { output: { turned_off: true, note: 'The computer is paused. Using any computer_* tool again switches it back on.' } };
            },
        };
    }

    /** Credentials with no bot list may be used by every bot; otherwise only by the listed ones (same rule as access keys). */
    private botMayUse(botId: string): Prisma.CredentialWhereInput {
        return { OR: [{ bots: { none: {} } }, { bots: { some: { bot_id: botId } } }] };
    }

    /** Saved website logins and password managers this bot may use for the acting user (metadata only), for the system prompt. */
    async websiteLogins(ctx: ToolContext): Promise<{ id: string; label: string; website: string | null; password_manager: boolean }[]> {
        if (!ctx.actor) return [];
        const rows = await this.prisma.credential.findMany({
            where: { AND: [this.access.usableCredentialsWhere(ctx.organization_id, ctx.actor.user_id), this.botMayUse(ctx.bot.id)], kind: { in: [CredentialKind.WEBSITE_LOGIN, CredentialKind.PASSWORD_MANAGER] }, status: CredentialStatus.ACTIVE },
            select: { id: true, label: true, website_domain: true, kind: true },
            orderBy: { created_at: 'asc' },
            take: 50,
        });
        return rows
            .filter((r) => r.kind === CredentialKind.PASSWORD_MANAGER || r.website_domain)
            .map((r) => ({ id: r.id, label: r.label, website: r.website_domain, password_manager: r.kind === CredentialKind.PASSWORD_MANAGER }));
    }

    /** Ends the run's computer session (minutes for usage) and refreshes the signed-in websites list. Never throws. */
    async finishRun(runId: string) {
        try {
            const sessions = await this.prisma.computerSession.findMany({ where: { run_id: runId, ended_at: null }, select: { cloud_computer_id: true } });
            for (const computerId of new Set(sessions.map((s) => s.cloud_computer_id))) {
                await this.computers.closeSessions(computerId, { run_id: runId });
                await this.computers.refreshSignedInSites(computerId).catch(() => undefined);
            }
        } catch (e) {
            this.logger.warn(`Closing computer session failed: ${(e as Error).message}`);
        }
    }

    // ---------------- Helpers ----------------

    /** Starts/resumes the computer, opens the run's session, and refuses while a person has control. */
    private async sandbox(ctx: ToolContext) {
        const { computer, sandbox } = await this.computers.ensureRunning(ctx.organization_id, ctx.bot.id, ctx.actor?.role ?? null);
        const controller = await this.computers.controllerOf(computer.id);
        if (controller) throw new Error(`${controller.name ?? 'A person'} is using the computer right now. Wait for them to hand control back, then try again.`);
        const session = await this.computers.openSession(computer.id, 'BOT_RUN', { run_id: ctx.run.id });
        if (!ctx.run.uses_computer) await this.prisma.run.update({ where: { id: ctx.run.id }, data: { uses_computer: true } });
        return { computer, sandbox, session };
    }

    /** Screenshot for the model, also saved as a replay frame (timeline, §9.2). */
    private async capture(ctx: ToolContext, sessionId: string, sandbox: Awaited<ReturnType<ComputersService['ensureRunning']>>['sandbox'], label: string): Promise<string | null> {
        try {
            await new Promise((r) => setTimeout(r, 700));
            const shot = await sandbox.computerUse.screenshot.takeCompressed({ format: 'jpeg', quality: 60, scale: 1, showCursor: true });
            const b64 = (shot as { screenshot?: string }).screenshot;
            if (!b64) return null;
            const frames = await this.prisma.file.count({ where: { computer_session_id: sessionId, area: 'REPLAYS' } });
            if (frames < MAX_FRAMES && ctx.user_settings?.keep_replays !== false) {
                const id = newId();
                const objectPath = `orgs/${ctx.organization_id}/replays/${id}`;
                const data = Buffer.from(b64, 'base64');
                await this.storage.write('REPLAYS', objectPath, data, 'image/jpeg');
                await this.prisma.file.create({
                    data: { id, organization_id: ctx.organization_id, uploaded_by_id: ctx.run.user_id, bucket: 'REPLAYS', area: 'REPLAYS', object_path: objectPath, filename: `${String(frames + 1).padStart(3, '0')} ${label.slice(0, 80)}.jpg`, mimetype: 'image/jpeg', size: BigInt(data.length), status: 'READY', computer_session_id: sessionId, run_id: ctx.run.id },
                });
            }
            return `data:image/jpeg;base64,${b64}`;
        } catch (e) {
            this.logger.warn(`Screenshot failed: ${(e as Error).message}`);
            return null;
        }
    }

    private withScreen(ctx: ToolContext, output: Record<string, unknown>, image: string | null): ToolResult {
        if (!image) return { output: { ...output, screen: 'Screenshot unavailable' } };
        if (!ctx.supports_vision) return { output: { ...output, screen: 'This model cannot see screenshots; prefer shell commands (e.g. curl) and ask the user to take control for visual steps.' } };
        return { output: { ...output, screen: 'Screenshot attached (1024×768; coordinates are in pixels from the top-left).' }, images: [image] };
    }

    private path(p: string | undefined) {
        const raw = (p || WORKSPACE).trim();
        const abs = raw.startsWith('/') ? raw : `${WORKSPACE}/${raw}`;
        const norm = abs.split('/').reduce<string[]>((acc, part) => (part === '..' ? acc.slice(0, -1) : part && part !== '.' ? [...acc, part] : acc), []);
        const out = `/${norm.join('/')}`;
        if (!out.startsWith(HOME) || out.startsWith(`${HOME}/.agentspace`) || out.startsWith(`${HOME}/.agentspace-browser`)) throw new Error(`Use paths inside ${WORKSPACE}`);
        return out;
    }

    // ---------------- Shell and files ----------------

    private runCommand(): ToolDef {
        return {
            name: 'computer_run',
            description: `Run a bash command on your private cloud computer (Ubuntu, Python 3, Node.js, Chromium; you can pip/npm install). Working folder: ${WORKSPACE}. Files persist between tasks. Use for data processing, scripts, conversions and file work. Long-running servers should be started in the background (&). ` +
                `Direct internet from this computer can be limited to package sites (pip, npm, GitHub); if curl or the browser cannot reach a site, do not keep retrying: fetch any public page or file with copy_to_computer instead, and search or read pages with web_search / read_webpage.`,
            parameters: obj({ command: { type: 'string' }, cwd: { type: 'string', description: `Folder, default ${WORKSPACE}` }, timeout_seconds: { type: 'number', description: 'Default 120, max 600' } }, ['command']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Running \`${String(a.command).slice(0, 70)}\``,
            execute: async (a, ctx) => {
                const { sandbox } = await this.sandbox(ctx);
                const timeout = Math.min(Math.max(Number(a.timeout_seconds) || 120, 5), 600);
                // The sandbox's login shell is zsh, which rejects unquoted "?" and "*" in URLs. Commands are written for bash, so run them in bash.
                const script = Buffer.from(String(a.command), 'utf8').toString('base64');
                const r = await sandbox.process.executeCommand(`bash -c "$(printf %s '${script}' | base64 -d)"`, this.path(a.cwd), undefined, timeout);
                const out = r.result ?? '';
                return { output: { exit_code: r.exitCode, output: out.length > 12_000 ? `${out.slice(0, 4000)}\n…[${out.length - 10_000} characters cut]…\n${out.slice(-6000)}` : out } };
            },
        };
    }

    private writeFile(): ToolDef {
        return {
            name: 'computer_write_file',
            description: 'Create or overwrite a text file on your cloud computer (scripts, data, notes).',
            parameters: obj({ path: { type: 'string', description: `Relative to ${WORKSPACE} or absolute` }, content: { type: 'string' } }, ['path', 'content']),
            step_type: 'FILE_WRITE',
            runs_on: 'server',
            title: (a) => `Writing ${String(a.path).split('/').pop()}`,
            execute: async (a, ctx) => {
                const { sandbox } = await this.sandbox(ctx);
                const p = this.path(a.path);
                const dir = p.slice(0, p.lastIndexOf('/'));
                await sandbox.process.executeCommand(`mkdir -p '${dir.replace(/'/g, "'\\''")}'`);
                await sandbox.fs.uploadFile(Buffer.from(String(a.content), 'utf8'), p);
                return { output: { path: p, bytes: Buffer.byteLength(String(a.content)) } };
            },
        };
    }

    private readFile(): ToolDef {
        return {
            name: 'computer_read_file',
            description: 'Read a text file from your cloud computer (first 15,000 characters from the offset).',
            parameters: obj({ path: { type: 'string' }, offset: { type: 'number' } }, ['path']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Reading ${String(a.path).split('/').pop()}`,
            execute: async (a, ctx) => {
                const { sandbox } = await this.sandbox(ctx);
                const p = this.path(a.path);
                const data = await sandbox.fs.downloadFile(p);
                if (data.subarray(0, 4000).includes(0)) return { output: { path: p, error: 'Binary file — use computer_run to inspect it, or copy_from_computer to share it.' } };
                const text = data.toString('utf8');
                const off = Number(a.offset) || 0;
                return { output: { path: p, total_characters: text.length, text: text.slice(off, off + 15_000), more: off + 15_000 < text.length ? { next_offset: off + 15_000 } : null } };
            },
        };
    }

    private listFiles(): ToolDef {
        return {
            name: 'computer_list_files',
            description: 'List a folder on your cloud computer.',
            parameters: obj({ path: { type: 'string', description: `Default ${WORKSPACE}` } }),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: () => 'Looking at files',
            execute: async (a, ctx) => {
                const { sandbox } = await this.sandbox(ctx);
                const p = this.path(a.path);
                const entries = await sandbox.fs.listFiles(p);
                return { output: { path: p, entries: entries.slice(0, 300).map((e) => ({ name: e.name, dir: e.isDir, size: e.size })) } };
            },
        };
    }

    // ---------------- Transfers (§9.5) ----------------

    private copyTo(): ToolDef {
        return {
            name: 'copy_to_computer',
            description:
                'Bring a file onto your cloud computer without exposing any sign-in: a stored file (file_id from the chat, knowledge or a skill), a public URL, or a raw API request made through one of your connected accounts (e.g. GitHub "GET /repos/{owner}/{repo}/tarball/{ref}"). Archives (.zip, .tar.gz) can be unpacked.',
            parameters: obj(
                {
                    source: {
                        type: 'object',
                        properties: {
                            file_id: { type: 'string' },
                            url: { type: 'string' },
                            connection_id: { type: 'string', description: 'Connected account to request through: its label as listed in your connected accounts (e.g. "GitHub – Work"), or its id' },
                            endpoint: { type: 'string', description: 'API path or full URL for the connected service' },
                        },
                    },
                    destination_path: { type: 'string', description: `File path, relative to ${WORKSPACE}` },
                    unpack: { type: 'boolean', description: 'Unpack an archive into a folder next to it' },
                },
                ['source', 'destination_path'],
            ),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Copying ${a.source?.url ? new URL(String(a.source.url)).hostname : a.source?.endpoint ? 'from a connected service' : 'a file'} to the computer`,
            execute: async (a, ctx) => {
                const { sandbox } = await this.sandbox(ctx);
                const dest = this.path(a.destination_path);
                let data: Buffer;
                let sourceKind: 'STORED_FILE' | 'PUBLIC_URL' | 'COMPOSIO';
                let sourceLabel: string;
                let connectionId: string | undefined;
                let fileId: string | undefined;
                const src = a.source ?? {};
                if (src.file_id) {
                    const f = await this.prisma.file.findFirst({ where: { id: String(src.file_id), organization_id: ctx.organization_id, deleted_at: null, status: 'READY' } });
                    if (!f) throw new Error('File not found');
                    const readable = (f.conversation_id && f.conversation_id === ctx.conversation_id) || (await this.prisma.knowledgeItem.count({ where: { file_id: f.id, deleted_at: null, OR: [{ bot_id: ctx.bot.id }, { scope: 'ORGANIZATION' }] } })) || (await this.prisma.skillFile.count({ where: { file_id: f.id } }));
                    if (!readable) throw new Error('You do not have access to this file');
                    if (Number(f.size) > TRANSFER_LIMIT) throw new Error('Transfers are limited to 1 GB');
                    data = (await this.files.readForTool(ctx.organization_id, f.id)).data;
                    sourceKind = 'STORED_FILE';
                    sourceLabel = f.filename;
                    fileId = f.id;
                } else if (src.url) {
                    const url = await assertPublicUrl(String(src.url));
                    data = await this.fetchLimited(url.toString());
                    sourceKind = 'PUBLIC_URL';
                    sourceLabel = `${url.origin}${url.pathname}`;
                } else if (src.connection_id && src.endpoint) {
                    // Bots know accounts by label; accept the label (or service name) as well as the id.
                    const ref = String(src.connection_id).trim();
                    const usable = await this.prisma.connection.findMany({ where: { ...this.access.usableConnectionsWhere(ctx.organization_id, ctx.actor!.user_id, ctx.bot.id), kind: 'COMPOSIO', status: 'ACTIVE' } });
                    const q = ref.toLowerCase();
                    const c = usable.find((x) => x.id === ref) ?? usable.find((x) => x.label.toLowerCase() === q) ?? usable.find((x) => x.service_name.toLowerCase() === q || x.service_key === q) ?? null;
                    if (!c?.composio_connected_account_id) throw new Error('That connected account is not available to you');
                    const res = await this.composio.proxy(c.composio_connected_account_id, { endpoint: String(src.endpoint), method: 'GET' });
                    if (res.status >= 400) throw new Error(`The service answered ${res.status}`);
                    const link = typeof res.data === 'object' && res.data ? (res.data.download_url ?? res.data.downloadUrl ?? res.data.url) : null;
                    if (typeof link === 'string' && /^https:\/\//.test(link)) data = await this.fetchLimited(link);
                    else if (typeof res.data === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(res.data) && res.data.length > 200) data = Buffer.from(res.data, 'base64');
                    else data = Buffer.from(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2), 'utf8');
                    sourceKind = 'COMPOSIO';
                    sourceLabel = `${c.label} ${String(src.endpoint).slice(0, 200)}`;
                    connectionId = c.id;
                } else throw new Error('Give a file_id, a url, or a connection_id with an endpoint');

                const dir = dest.slice(0, dest.lastIndexOf('/'));
                await sandbox.process.executeCommand(`mkdir -p '${dir.replace(/'/g, "'\\''")}'`);
                await sandbox.fs.uploadFile(data, dest);
                let unpacked: string | null = null;
                if (a.unpack) {
                    const q = `'${dest.replace(/'/g, "'\\''")}'`;
                    const target = dest.replace(/(\.tar\.gz|\.tgz|\.zip|\.tar)$/i, '') || `${dest}-files`;
                    const cmd = /\.zip$/i.test(dest) ? `mkdir -p '${target}' && unzip -o -q ${q} -d '${target}'` : `mkdir -p '${target}' && tar -xf ${q} -C '${target}'`;
                    const r = await sandbox.process.executeCommand(cmd, undefined, undefined, 300);
                    unpacked = r.exitCode === 0 ? target : null;
                }
                await this.computers.recordTransfer(ctx.bot.id, { run_id: ctx.run.id, direction: 'TO_COMPUTER', source_kind: sourceKind, connection_id: connectionId, file_id: fileId, source: sourceLabel, destination: dest, size_bytes: data.length });
                await this.activity.log({ organization_id: ctx.organization_id, actor_bot_id: ctx.bot.id, on_behalf_of_id: ctx.run.user_id, action: 'computer.copy_in', target_type: 'bot', target_id: ctx.bot.id, connection_id: connectionId, run_id: ctx.run.id, metadata: { source: sourceLabel, destination: dest, bytes: data.length } });
                return { output: { path: dest, bytes: data.length, unpacked_to: unpacked }, connection_id: connectionId };
            },
        };
    }

    private async fetchLimited(url: string): Promise<Buffer> {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) });
        if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
        const len = Number(res.headers.get('content-length') ?? 0);
        if (len > TRANSFER_LIMIT) throw new Error('Transfers are limited to 1 GB');
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
            total += chunk.length;
            if (total > TRANSFER_LIMIT) throw new Error('Transfers are limited to 1 GB');
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    private copyFrom(): ToolDef {
        return {
            name: 'copy_from_computer',
            description: 'Share a file from your cloud computer into this chat (it is saved to Agent Space file storage and appears as a download).',
            parameters: obj({ path: { type: 'string' } }, ['path']),
            step_type: 'FILE_WRITE',
            runs_on: 'server',
            title: (a) => `Sharing ${String(a.path).split('/').pop()} from the computer`,
            execute: async (a, ctx) => {
                if (!ctx.conversation_id) throw new Error('There is no chat to share into');
                const { sandbox } = await this.sandbox(ctx);
                const p = this.path(a.path);
                const info = await sandbox.fs.getFileDetails(p);
                if (info.isDir) throw new Error('That is a folder — zip it first with computer_run (zip -r out.zip folder)');
                if (info.size > TRANSFER_LIMIT) throw new Error('Transfers are limited to 1 GB');
                const data = await sandbox.fs.downloadFile(p);
                const f = await this.computers.saveFromComputer(ctx.organization_id, ctx.run.user_id, ctx.conversation_id, ctx.run.id, p.split('/').pop()!, data);
                await ctx.addPart({ type: 'file', file_id: f.id, filename: f.filename, mimetype: f.mimetype, size: Number(f.size) });
                await this.computers.recordTransfer(ctx.bot.id, { run_id: ctx.run.id, direction: 'FROM_COMPUTER', source_kind: 'CHAT', file_id: f.id, source: p, destination: `conversation:${ctx.conversation_id}`, size_bytes: data.length });
                return { output: { file_id: f.id, filename: f.filename, size: data.length } };
            },
        };
    }

    // ---------------- Browser / desktop ----------------

    private openUrl(): ToolDef {
        return {
            name: 'computer_open_url',
            description: 'Open a web page in the browser on your cloud computer (it keeps sign-ins between tasks). Returns a screenshot.',
            parameters: obj({ url: { type: 'string' } }, ['url']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Opening ${(() => { try { return new URL(String(a.url)).hostname; } catch { return 'a page'; } })()}`,
            execute: async (a, ctx) => {
                const url = new URL(String(a.url));
                if (!/^https?:$/.test(url.protocol)) throw new Error('Only http(s) pages can be opened');
                const { sandbox, session } = await this.sandbox(ctx);
                // Some sandboxes can only reach package sites. Check first, so the bot gets a clear answer instead of a browser error page.
                const probe = await sandbox.process.executeCommand(`curl -s -o /dev/null -m 8 -w '%{http_code}' '${url.origin.replace(/'/g, '%27')}/'`, undefined, undefined, 20).catch(() => null);
                if (probe && probe.result.trim().endsWith('000')) {
                    throw new Error(`This cloud computer cannot reach ${url.hostname} directly (its internet access is limited), so the browser cannot open it. Fetch the page with copy_to_computer (url: "${url.toString()}"), or read it with read_webpage / web_search, and process it with computer_run. Do not retry computer_open_url for this site.`);
                }
                // Refresh the launcher each time so computers created by older versions get the current flags.
                await sandbox.fs.uploadFile(Buffer.from(OPEN_BROWSER), OPEN_BROWSER_PATH);
                await sandbox.process.executeCommand(`chmod +x ${OPEN_BROWSER_PATH} && ${OPEN_BROWSER_PATH} '${url.toString().replace(/'/g, '%27')}'`, undefined, undefined, 30);
                await new Promise((r) => setTimeout(r, 2500));
                return this.withScreen(ctx, { opened: url.toString() }, await this.capture(ctx, session.id, sandbox, `Open ${url.hostname}`));
            },
        };
    }

    private screenshot(): ToolDef {
        return {
            name: 'computer_screenshot',
            description: 'See the current screen of your cloud computer.',
            parameters: obj({}),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: () => 'Looking at the screen',
            execute: async (_a, ctx) => {
                const { sandbox, session } = await this.sandbox(ctx);
                return this.withScreen(ctx, {}, await this.capture(ctx, session.id, sandbox, 'Screen'));
            },
        };
    }

    private click(): ToolDef {
        return {
            name: 'computer_click',
            description: 'Click at a screen position (pixels, from the latest screenshot). Returns a new screenshot.',
            parameters: obj({ x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'right', 'middle'] }, double: { type: 'boolean' }, effect: effectParam, describe: { type: 'string', description: 'What you are clicking, e.g. "the Place order button"' } }, ['x', 'y', 'effect', 'describe']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Clicking ${String(a.describe ?? '').slice(0, 60)}`,
            classify: (a) => EFFECT_ACTION[String(a.effect)] ?? null,
            preview: async (a, ctx) => this.preview(a, ctx, `Click "${a.describe}" on the cloud computer`),
            execute: async (a, ctx) => {
                const { sandbox, session } = await this.sandbox(ctx);
                await sandbox.computerUse.mouse.click(Math.round(Number(a.x)), Math.round(Number(a.y)), String(a.button ?? 'left'), !!a.double);
                return this.withScreen(ctx, { clicked: { x: a.x, y: a.y } }, await this.capture(ctx, session.id, sandbox, `Click ${a.describe ?? ''}`));
            },
        };
    }

    private type(): ToolDef {
        return {
            name: 'computer_type',
            description: 'Type text into the focused field on your cloud computer. Never use this for passwords, payment card numbers or two-step codes — call computer_ask_user so the person signs in themselves.',
            parameters: obj({ text: { type: 'string' }, press_enter: { type: 'boolean' }, effect: effectParam }, ['text', 'effect']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Typing "${String(a.text).slice(0, 40)}${String(a.text).length > 40 ? '…' : ''}"`,
            classify: (a) => (a.press_enter ? (EFFECT_ACTION[String(a.effect)] ?? null) : null),
            preview: async (a, ctx) => this.preview(a, ctx, `Type "${String(a.text).slice(0, 200)}" and press Enter on the cloud computer`),
            execute: async (a, ctx) => {
                const { sandbox, session } = await this.sandbox(ctx);
                await sandbox.computerUse.keyboard.type(String(a.text), 15);
                if (a.press_enter) await sandbox.computerUse.keyboard.press('Return');
                return this.withScreen(ctx, { typed: String(a.text).length }, await this.capture(ctx, session.id, sandbox, 'Type'));
            },
        };
    }

    private key(): ToolDef {
        return {
            name: 'computer_key',
            description: 'Press a key or shortcut on your cloud computer, e.g. "Return", "Tab", "Escape", "ctrl+l", "ctrl+a", "alt+Left", "Page_Down".',
            parameters: obj({ keys: { type: 'string' }, effect: effectParam }, ['keys', 'effect']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Pressing ${String(a.keys).slice(0, 30)}`,
            classify: (a) => EFFECT_ACTION[String(a.effect)] ?? null,
            preview: async (a, ctx) => this.preview(a, ctx, `Press ${a.keys} on the cloud computer`),
            execute: async (a, ctx) => {
                const { sandbox, session } = await this.sandbox(ctx);
                const keys = String(a.keys);
                if (keys.includes('+')) await sandbox.computerUse.keyboard.hotkey(keys);
                else await sandbox.computerUse.keyboard.press(keys);
                return this.withScreen(ctx, { pressed: keys }, await this.capture(ctx, session.id, sandbox, `Press ${keys}`));
            },
        };
    }

    private scroll(): ToolDef {
        return {
            name: 'computer_scroll',
            description: 'Scroll at a screen position on your cloud computer.',
            parameters: obj({ x: { type: 'number' }, y: { type: 'number' }, direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, amount: { type: 'number', description: 'Wheel steps, default 5' } }, ['direction']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Scrolling ${a.direction}`,
            execute: async (a, ctx) => {
                const { sandbox, session } = await this.sandbox(ctx);
                await sandbox.computerUse.mouse.scroll(Number(a.x ?? 512), Number(a.y ?? 400), a.direction, Number(a.amount) || 5);
                return this.withScreen(ctx, {}, await this.capture(ctx, session.id, sandbox, `Scroll ${a.direction}`));
            },
        };
    }

    private async preview(a: Record<string, unknown>, ctx: ToolContext, title: string) {
        const action = EFFECT_ACTION[String(a.effect)] ?? 'OTHER';
        let image: string | null = null;
        try {
            const { sandbox } = await this.sandbox(ctx);
            const shot = await sandbox.computerUse.screenshot.takeCompressed({ format: 'jpeg', quality: 50, scale: 0.6 });
            image = (shot as { screenshot?: string }).screenshot ? `data:image/jpeg;base64,${(shot as { screenshot: string }).screenshot}` : null;
        } catch {
            image = null;
        }
        return { title, action_type: action, preview: { kind: 'computer', description: title, effect: a.effect, screenshot: image }, requires_tap: action === 'PURCHASE_PAYMENT' };
    }

    // ---------------- Saved website logins (§9.4) ----------------

    /**
     * The saved login (or password manager, §16) the call names, if the acting user and this bot may use it and it
     * covers the website given. `domain` is where typing is allowed: the saved login's website, or for a password
     * manager the website asked for (its stored item must cover that website, checked when the values are read).
     */
    private async loginFor(ctx: ToolContext, a: Record<string, unknown>) {
        const c = await this.prisma.credential.findFirst({
            where: { id: String(a.credential_id ?? ''), kind: { in: [CredentialKind.WEBSITE_LOGIN, CredentialKind.PASSWORD_MANAGER] }, AND: [this.access.usableCredentialsWhere(ctx.organization_id, ctx.actor!.user_id), this.botMayUse(ctx.bot.id)] },
        });
        const manager = c?.kind === CredentialKind.PASSWORD_MANAGER;
        if (!c || (!manager && !c.website_domain)) throw new Error('No saved login with that id is available to you. Use one from "Saved website logins", or ask the user to save one with request_secret (kind "website_login").');
        if (c.status !== CredentialStatus.ACTIVE) throw new Error(`The saved login "${c.label}" is marked as not working. Ask the user to update it on the Secrets page, or to sign in themselves with computer_ask_user.`);
        const site = normalizeWebsiteDomain(String(a.website ?? ''));
        if (!site) throw new Error('Give the website you are signing in to, e.g. "portal.acme.com".');
        if (!manager && !hostMatchesDomain(site, c.website_domain!)) throw new Error(`The saved login "${c.label}" is only for ${c.website_domain}.`);
        return { ...c, domain: manager ? site : c.website_domain!, password_manager: manager };
    }

    /** The username, password and two-step secret to type: from the saved login, or looked up in the password manager. */
    private async loginValues(login: Awaited<ReturnType<ComputerToolsService['loginFor']>>): Promise<{ username: string | null; password: string | null; totp_secret: string | null; from: string | null }> {
        const value = await this.secrets.access(login.secret_resource_name);
        if (!login.password_manager) return { username: value.username ?? null, password: value.password ?? null, totp_secret: value.totp_secret ?? null, from: null };
        const found = await this.onePassword.findLogin(String(value.base_url ?? ''), String(value.api_key ?? ''), login.domain).catch((e: Error) => {
            throw new Error(`Could not read ${login.label}: ${e.message}. Ask the user to check the password manager on the Secrets page, or use computer_ask_user.`);
        });
        if (!found) throw new Error(`${login.label} has no login for ${login.domain}. Ask the user to add one there, or to sign in themselves with computer_ask_user.`);
        return { ...found, from: found.item_title };
    }

    private signInMessage(r: SignInScriptResult, domain: string): string {
        switch (r.error) {
            case SignInErrors.WRONG_SITE:
                return `Nothing was typed: the open page is on ${r.host ?? 'another site'}, but this login is only for ${domain}. Open the sign-in page of ${domain} with computer_open_url first.`;
            case SignInErrors.NOT_HTTPS:
                return 'Nothing was typed: the sign-in page is not secure (https). Logins are only typed into https pages.';
            case SignInErrors.FIELD_NOT_FOUND:
                return `Could not find the ${r.missing ?? 'sign-in'} field on the page. Make sure the sign-in form is showing (click "Sign in" / "Log in" if needed), click into the field, then try again.`;
            case SignInErrors.IN_FRAME:
                return 'The sign-in form is inside an embedded frame, where logins are never typed. Open the sign-in page directly, or use computer_ask_user.';
            case SignInErrors.NOT_TYPED:
                return 'The field did not accept the typing. Click into the field and try again, or use computer_ask_user.';
            case SignInErrors.NO_BROWSER:
            case SignInErrors.NO_PAGE:
                return `The browser is not open. Open the sign-in page of ${domain} with computer_open_url first.`;
            default:
                return 'Signing in failed. Take a screenshot to see the page, or use computer_ask_user.';
        }
    }

    private signIn(): ToolDef {
        return {
            name: 'computer_sign_in',
            description:
                'Sign in to a website in your cloud computer\'s browser with a login the user saved, or one from a connected password manager (both listed under "Saved website logins"). Open the site\'s sign-in page first with computer_open_url. ' +
                'The username, password or two-step code are typed straight into the page for you (you never see them), and only when the open page is https on the login\'s own website or its subdomains. ' +
                'Use "username_and_password" for a normal form; for sign-ins split over two pages use "username", then "password" on the next page. Use "two_step_code" when the site asks for an authenticator-app code and the login has one. ' +
                'For codes sent by text or email, "prove you are human" checks, or when there is no saved login, use computer_ask_user.',
            parameters: obj(
                {
                    credential_id: { type: 'string', description: 'Id of the saved login or password manager' },
                    website: { type: 'string', description: 'The website you are signing in to, e.g. "portal.acme.com" (for a saved login, its own website)' },
                    fields: { type: 'string', enum: SIGN_IN_FIELDS, description: 'What to type' },
                    submit: { type: 'boolean', description: 'Press Enter afterwards to submit. Default true.' },
                },
                ['credential_id', 'website', 'fields'],
            ),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: (a) => `Signing in to ${String(a.website ?? 'a website').slice(0, 60)}`,
            // Typing only a username reveals nothing secret; passwords and codes need approval (tap only, or an automation pre-approval for "website:<site>").
            classify: (a) => (a.fields === SignInFields.USERNAME ? null : ActionType.ENTER_PASSWORD),
            preview: async (a, ctx) => {
                const login = await this.loginFor(ctx, a);
                const title = login.password_manager ? `Sign in to ${login.domain} with ${login.label}` : `Sign in to ${login.domain} as ${login.masked_hint ?? login.label}`;
                let screenshot: string | null = null;
                try {
                    const { sandbox } = await this.sandbox(ctx);
                    const shot = await sandbox.computerUse.screenshot.takeCompressed({ format: 'jpeg', quality: 50, scale: 0.6 });
                    screenshot = (shot as { screenshot?: string }).screenshot ? `data:image/jpeg;base64,${(shot as { screenshot: string }).screenshot}` : null;
                } catch {
                    screenshot = null;
                }
                const using = login.password_manager ? `the login stored in ${login.label}` : `the saved login "${login.label}"`;
                return { title, action_type: ActionType.ENTER_PASSWORD, preview: { kind: 'computer', description: `${title} using ${using}`, effect: 'sign_in', screenshot }, requires_tap: true };
            },
            execute: async (a, ctx) => {
                const fields = String(a.fields) as SignInField;
                if (!SIGN_IN_FIELDS.includes(fields)) throw new Error(`fields must be one of: ${SIGN_IN_FIELDS.join(', ')}`);
                const login = await this.loginFor(ctx, a);
                const domain = login.domain;
                const value = await this.loginValues(login);
                const steps: SignInScriptInput['steps'] = SIGN_IN_STEPS[fields].map((kind) => ({
                    kind,
                    text: kind === 'username' ? (value.username ?? '') : kind === 'password' ? (value.password ?? '') : value.totp_secret ? totpCode(value.totp_secret) : '',
                }));
                const empty = steps.find((st) => !st.text);
                const named = value.from ? `The login "${value.from}" in ${login.label}` : `The saved login "${login.label}"`;
                if (empty) throw new Error(empty.kind === 'code' ? `${named} has no two-step secret. Ask the user to enter the code with computer_ask_user.` : `${named} has no ${empty.kind}. Ask the user to update it${value.from ? ` in ${login.label}` : ' on the Secrets page'}.`);
                for (const st of steps) if (st.kind !== 'username') ctx.secrets_used.push(st.text);

                const { sandbox, session } = await this.sandbox(ctx);
                const running = await sandbox.process.executeCommand(`pgrep -f "remote-debugging-port=${BROWSER_DEBUG_PORT}" > /dev/null && echo yes || echo no`, undefined, undefined, 15);
                if (!running.result.includes('yes')) {
                    // No browser, or one from before sign-in support: the launcher (re)starts it with the DevTools port; sign-ins are kept.
                    await sandbox.fs.uploadFile(Buffer.from(OPEN_BROWSER), OPEN_BROWSER_PATH);
                    throw new Error(`Open the sign-in page of ${domain} with computer_open_url first (the browser reopens ready for signing in), then call computer_sign_in again.`);
                }

                const input: SignInScriptInput = { domain, steps, submit: a.submit !== false };
                const inputPath = `${HOME}/.agentspace/sign-in-${randomToken(12)}.json`;
                await sandbox.fs.uploadFile(Buffer.from(SIGN_IN_SCRIPT), SIGN_IN_SCRIPT_PATH);
                let result: SignInScriptResult;
                try {
                    await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(input)), inputPath);
                    const r = await sandbox.process.executeCommand(`node ${SIGN_IN_SCRIPT_PATH} '${inputPath}'`, undefined, undefined, 60);
                    result = JSON.parse(r.result.trim().split('\n').pop() || '{}') as SignInScriptResult;
                } catch {
                    result = { ok: false, error: SignInErrors.FAILED };
                } finally {
                    // The helper deletes its input as soon as it reads it; this covers a helper that never started.
                    await sandbox.process.executeCommand(`rm -f '${inputPath}'`, undefined, undefined, 15).catch(() => undefined);
                }

                if (result.filled?.length) {
                    await this.prisma.credential.update({ where: { id: login.id }, data: { last_used_at: new Date(), last_used_bot_id: ctx.bot.id } });
                    await this.prisma.credentialEvent.create({ data: { credential_id: login.id, type: 'USED', actor_bot_id: ctx.bot.id, actor_user_id: ctx.run.user_id, run_id: ctx.run.id, action: `Signed in on ${result.host ?? domain}`, metadata: { fields: result.filled, submitted: !!result.submitted, ...(value.from ? { item: value.from } : {}) } } });
                    await this.activity.log({ organization_id: ctx.organization_id, actor_bot_id: ctx.bot.id, on_behalf_of_id: ctx.run.user_id, action: 'secret.used', target_type: 'credential', target_id: login.id, run_id: ctx.run.id, metadata: { website: result.host ?? domain, fields: result.filled } });
                }
                if (!result.ok) throw new Error(this.signInMessage(result, domain));
                if (result.submitted) await new Promise((r) => setTimeout(r, 2500));
                const output: Record<string, unknown> = { website: result.host ?? domain, typed: result.filled, submitted: !!result.submitted };
                if (result.missing) output.next = `The ${result.missing} field is not on this page yet. Once it shows, call computer_sign_in again with fields "${result.missing === 'code' ? SignInFields.TWO_STEP_CODE : result.missing}".`;
                return this.withScreen(ctx, output, await this.capture(ctx, session.id, sandbox, `Sign in to ${domain}`));
            },
        };
    }

    /**
     * Hands the computer to the user (sign-in, two-step code, "prove you're human", or showing how) and waits
     * until they hand it back (§9.2, §9.4). Passwords never pass through the bot.
     */
    private askUser(): ToolDef {
        return {
            name: 'computer_ask_user',
            description:
                'Ask the user to take control of your cloud computer — to sign in to a website, enter a two-step code or password, solve a "prove you are human" check, or show you something. The run pauses until they hand control back. Explain what they need to do in one sentence.',
            parameters: obj({ reason: { type: 'string', description: 'e.g. "Please sign in to the supplier portal (portal.acme.com), then hand control back."' }, kind: { type: 'string', enum: ['sign_in', 'two_step_code', 'captcha', 'other'] } }, ['reason', 'kind']),
            step_type: 'COMPUTER_ACTION',
            runs_on: 'server',
            title: () => 'Asking you to take control',
            execute: async (a, ctx) => {
                await this.sandbox(ctx);
                const request_id = randomToken(12);
                if (ctx.run.user_id) await this.computers.notifyTakeControl(ctx.run.user_id, ctx.organization_id, ctx.bot.name, String(a.reason), ctx.conversation_id ? `/c/${ctx.conversation_id}` : `/bots/${ctx.bot.id}`);
                return { wait: 'input', request_id, part: { type: 'computer_handoff', request_id, bot_id: ctx.bot.id, reason: String(a.reason).slice(0, 400), kind: a.kind, status: 'waiting' } };
            },
        };
    }
}
