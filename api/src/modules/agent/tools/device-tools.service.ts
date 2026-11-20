import { Injectable, Logger } from '@nestjs/common';
import { Device, DeviceToolKind, DeviceToolPermission } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { StorageService } from '@/integrations/storage/storage.service';
import { newId, randomToken } from '@/shared/utils/security/crypto.utils';
import { ActivityService } from '../../activity/activity.service';
import { classifyToolSlug } from '../approval-policy';
import { EFFECT_ACTION, effectParam } from './computer-tools.service';
import { obj, ToolContext, ToolDef, ToolResult } from './tool.types';

/** Waiting for the device: plain calls, calls that wait for the user (pickers, "Allow" cards), and automations (§14.3). */
const CALL_TIMEOUT_MS = 30_000;
const USER_TIMEOUT_MS = 120_000;
const AUTOMATION_OFFLINE_WAIT_MS = 60 * 60_000;
const OFFLINE_POLL_MS = 15_000;
const INLINE_MAX_BYTES = 1024 ** 2;

/** Defaults when the user never touched a switch: ask each time; control my computer starts off (§14.3). */
const DEFAULT_PERMISSION: Partial<Record<DeviceToolKind, DeviceToolPermission>> = { CONTROL_COMPUTER: 'NEVER' };
const DESKTOP_KINDS: DeviceToolKind[] = ['LOCAL_FILES', 'SCREEN', 'LOCAL_TOOL_SERVERS', 'CLIPBOARD', 'OPEN', 'CONTROL_COMPUTER'];
const MOBILE_KINDS: DeviceToolKind[] = ['CAMERA_SCANNER', 'CONTACTS', 'SEND_VIA_APPS', 'DEVICE_CALENDAR', 'LOCATION'];
/** Mobile ops — mirror app/src/platform/mobile-device-ops.ts. */
const MobileOps = { SCAN: 'scan', CONTACTS_SEARCH: 'contacts_search', SEND_VIA_APP: 'send_via_app', CALENDAR_LIST: 'calendar_list', CALENDAR_CREATE: 'calendar_create', LOCATION_CURRENT: 'location_current' } as const;

/** What the app receives on its real-time connection and answers with `device:result`. */
export interface DeviceCall {
    request_id: string;
    device_id: string;
    tool: DeviceToolKind;
    /** Tool-specific operation, e.g. "files", "screen", "clipboard_write", "open", "local_tool", "control". */
    op: string;
    args: Record<string, unknown>;
    permission: DeviceToolPermission;
    run_id: string;
    conversation_id: string | null;
    bot: { id: string; name: string; emoji: string | null };
    /** A short line for the "Ask each time" card: "Sales Sam wants to …". */
    summary: string;
    timeout_ms: number;
}

export interface LocalToolInfo {
    serverId: string;
    serverName: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

type OnlineDevice = Device & { permissions: Map<DeviceToolKind, DeviceToolPermission> };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'tool';

/**
 * Device tools (§14.3): tools that run on the user's own computer, offered only while that computer is online with
 * Agent Space signed in and the tool switched on. Calls go over the existing real-time connection: published on a
 * Redis channel, forwarded by whichever API instance holds the device's socket, answered on a reply list.
 */
@Injectable()
export class DeviceToolsService {
    private readonly logger = new Logger(DeviceToolsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly storage: StorageService,
        private readonly activity: ActivityService,
    ) { }

    // ------------------------------------------------------------------ which devices and tools

    private async isOnline(deviceId: string) {
        return (await this.redis.client.exists(this.redis.key(RedisKeys.deviceOnline(deviceId)))) > 0;
    }

    /** The user's desktop computers with their switches; `onlineOnly` false also returns offline ones (automations wait). */
    async desktops(userId: string, onlineOnly = true) {
        return this.devicesOf(userId, 'DESKTOP', DESKTOP_KINDS, onlineOnly);
    }

    private async devicesOf(userId: string, platform: 'DESKTOP' | 'ANDROID', kinds: DeviceToolKind[], onlineOnly: boolean): Promise<(OnlineDevice & { online: boolean })[]> {
        const rows = await this.prisma.device.findMany({
            where: { user_id: userId, platform, sessions: { some: { revoked_at: null, expires_at: { gt: new Date() } } } },
            include: { tool_permissions: true },
            orderBy: { last_seen_at: 'desc' },
        });
        const out: (OnlineDevice & { online: boolean })[] = [];
        for (const d of rows) {
            const online = await this.isOnline(d.id);
            if (onlineOnly && !online) continue;
            const permissions = new Map<DeviceToolKind, DeviceToolPermission>(kinds.map((k) => [k, DEFAULT_PERMISSION[k] ?? 'ASK_EACH_TIME']));
            for (const p of d.tool_permissions) permissions.set(p.tool, p.permission);
            out.push({ ...d, permissions, online });
        }
        return out;
    }

    private allowedByOrg(ctx: ToolContext, kind: DeviceToolKind) {
        const s = ctx.org_settings;
        if (!s) return true;
        if (!s.device_tools_enabled) return false;
        if (!s.allowed_device_tools.includes(kind)) return false;
        if (ctx.run.automation_run_id && (kind === 'CONTROL_COMPUTER' || !s.automations_desktop_tools)) return false;
        return true;
    }

    async tools(ctx: ToolContext): Promise<{ tools: ToolDef[]; summary: string[] }> {
        if (!ctx.actor || !ctx.run.user_id || ctx.is_temporary) return { tools: [], summary: [] };
        // Automations may wait for an offline computer; chats only see computers that are online right now.
        const devices = await this.desktops(ctx.run.user_id, !ctx.run.automation_run_id);
        // Phones: only while online, never in automations (place-based triggers aside, §14.3).
        const phones = ctx.run.automation_run_id ? [] : await this.devicesOf(ctx.run.user_id, 'ANDROID', MOBILE_KINDS, true);
        if (!devices.length && !phones.length) return { tools: [], summary: [] };
        const usableOf = (list: typeof devices) => (kind: DeviceToolKind) => list.filter((d) => d.permissions.get(kind) !== 'NEVER' && (d.capabilities.length === 0 || d.capabilities.includes(kind)) && this.allowedByOrg(ctx, kind));
        const usable = usableOf(devices);
        const usablePhone = usableOf(phones);

        const out: ToolDef[] = [];
        const addPhone = (kind: DeviceToolKind, make: (list: typeof phones) => ToolDef | ToolDef[]) => {
            const list = usablePhone(kind);
            if (list.length) out.push(...([] as ToolDef[]).concat(make(list)));
        };
        addPhone('CAMERA_SCANNER', (l) => this.scan(l));
        addPhone('CONTACTS', (l) => this.contacts(l));
        addPhone('SEND_VIA_APPS', (l) => this.sendViaApp(l));
        addPhone('DEVICE_CALENDAR', (l) => this.phoneCalendar(l));
        addPhone('LOCATION', (l) => this.location(l));
        const add = (kind: DeviceToolKind, make: (list: typeof devices) => ToolDef | ToolDef[]) => {
            const list = usable(kind);
            if (list.length) out.push(...([] as ToolDef[]).concat(make(list)));
        };
        add('LOCAL_FILES', (l) => this.localFiles(l));
        add('SCREEN', (l) => this.lookAtScreen(l));
        add('CLIPBOARD', (l) => this.clipboard(l));
        add('OPEN', (l) => this.open(l));
        add('CONTROL_COMPUTER', (l) => this.controlComputer(l));
        const servers = usable('LOCAL_TOOL_SERVERS');
        for (const d of servers) out.push(...(await this.localServerTools(d)));

        const summary = [
            ...(devices.length ? [`Your user's computers: ${devices.map((d) => `"${d.name}" (${d.online ? 'online' : 'offline'})`).join(', ')}. Device tools run there; the user may be asked to allow each use.`] : []),
            ...(phones.length ? [`Your user's phones (online): ${phones.map((d) => `"${d.name}"`).join(', ')}. Phone tools run there; the user may be asked to allow each use.`] : []),
        ];
        return { tools: out, summary };
    }

    // ------------------------------------------------------------------ calling the device

    private pick(devices: OnlineDevice[], args: any) {
        const name = args?.computer ?? args?.phone;
        return (name ? devices.find((d) => d.name === name) : undefined) ?? devices[0];
    }

    private computerParam(devices: OnlineDevice[]) {
        return devices.length > 1 ? { computer: { type: 'string', enum: devices.map((d) => d.name), description: `Which computer. Default: "${devices[0].name}" (the one used most recently). Ask the user if unclear.` } } : {};
    }

    /** Sends one call to the device and waits for its answer. Throws "device not responding" on timeout (§14.3). */
    async call(ctx: ToolContext, device: OnlineDevice, tool: DeviceToolKind, op: string, args: Record<string, unknown>, summary: string, waitsForUser: boolean): Promise<any> {
        if (!(await this.isOnline(device.id))) {
            if (!ctx.run.automation_run_id) throw new Error(`"${device.name}" is offline. Agent Space must be open and signed in on it.`);
            const until = Date.now() + AUTOMATION_OFFLINE_WAIT_MS;
            while (!(await this.isOnline(device.id))) {
                if (Date.now() > until) throw new Error(`"${device.name}" stayed offline for an hour, so this step could not run.`);
                await new Promise((r) => setTimeout(r, OFFLINE_POLL_MS));
            }
        }
        const timeout = waitsForUser || device.permissions.get(tool) === 'ASK_EACH_TIME' ? USER_TIMEOUT_MS : CALL_TIMEOUT_MS;
        const requestId = randomToken(16);
        const payload: DeviceCall = {
            request_id: requestId,
            device_id: device.id,
            tool,
            op,
            args,
            permission: device.permissions.get(tool) ?? 'ASK_EACH_TIME',
            run_id: ctx.run.id,
            conversation_id: ctx.conversation_id,
            bot: { id: ctx.bot.id, name: ctx.bot.name, emoji: ctx.bot.emoji ?? null },
            summary,
            timeout_ms: timeout,
        };
        await this.redis.client.set(this.redis.key(RedisKeys.deviceRequest(requestId)), device.id, 'PX', timeout + 30_000);
        const receivers = await this.redis.client.publish(this.redis.key(RedisKeys.deviceChannel(device.id)), JSON.stringify(payload));
        if (!receivers) throw new Error(`"${device.name}" is not connected right now.`);

        const blocking = this.redis.duplicate();
        try {
            const res = await blocking.blpop(this.redis.key(RedisKeys.deviceReply(requestId)), Math.ceil(timeout / 1000));
            if (!res) throw new Error(waitsForUser ? 'No answer on the computer in time, so nothing was done.' : 'The device is not responding.');
            const reply = JSON.parse(res[1]) as { ok: boolean; data?: unknown; error?: string };
            await this.activity.log({ organization_id: ctx.organization_id, actor_bot_id: ctx.bot.id, on_behalf_of_id: ctx.run.user_id, action: 'device_tool.used', target_type: 'device_tool', target_id: tool, device_id: device.id, run_id: ctx.run.id, metadata: { op, ok: reply.ok, error: reply.error?.slice(0, 200) } });
            if (!reply.ok) throw new Error(reply.error || 'The computer refused this action.');
            return reply.data;
        } finally {
            blocking.disconnect();
        }
    }

    /** Large file contents and images are stored (§7.7) and returned as file IDs instead of inline (§14.3 Results). */
    private async storeLarge(ctx: ToolContext, filename: string, mimetype: string, data: Buffer) {
        const id = newId();
        const path = `orgs/${ctx.organization_id}/generated/${id}`;
        await this.storage.write('FILES', path, data, mimetype);
        await this.prisma.file.create({
            data: { id, organization_id: ctx.organization_id, uploaded_by_id: ctx.run.user_id, bucket: 'FILES', area: 'GENERATED', object_path: path, filename, mimetype, size: BigInt(data.length), status: 'READY', conversation_id: ctx.conversation_id, run_id: ctx.run.id },
        });
        return id;
    }

    private withImage(ctx: ToolContext, output: Record<string, unknown>, image: { dataUrl: string; width: number; height: number } | undefined): ToolResult {
        if (!image?.dataUrl) return { output };
        if (!ctx.supports_vision) return { output: { ...output, screen: 'This AI model cannot see images. Tell the user to switch the bot to a model that can.' } };
        return { output: { ...output, screen: `Image attached (${image.width}×${image.height}; coordinates are pixels from the top-left).` }, images: [image.dataUrl] };
    }

    // ------------------------------------------------------------------ the tools

    private localFiles(devices: OnlineDevice[]): ToolDef {
        return {
            name: 'local_files',
            description:
                "Work with files on the user's own computer, ONLY inside folders the user allowed (Settings → Devices). Actions: list (path empty = the allowed folders), search (by file name), read, write (new file; set overwrite to replace one), move (also renames), delete (to the trash). Deleting or overwriting always asks the user first.",
            parameters: obj(
                {
                    action: { type: 'string', enum: ['list', 'search', 'read', 'write', 'move', 'delete'] },
                    path: { type: 'string', description: 'File or folder path (absolute, or relative to an allowed folder)' },
                    to: { type: 'string', description: 'move: destination path' },
                    query: { type: 'string', description: 'search: part of the file name' },
                    content: { type: 'string', description: 'write: file content' },
                    encoding: { type: 'string', enum: ['utf8', 'base64'] },
                    overwrite: { type: 'boolean' },
                    ...this.computerParam(devices),
                },
                ['action'],
            ),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `${{ list: 'Listing', search: 'Searching', read: 'Reading', write: 'Saving', move: 'Moving', delete: 'Deleting' }[String(a.action)] ?? 'Using'} files on ${this.pick(devices, a).name}${a.path ? ` — ${String(a.path).split(/[\\/]/).pop()}` : a.query ? ` for "${a.query}"` : ''}`,
            classify: (a) => (a.action === 'delete' ? 'DELETE_DATA' : a.action === 'write' && a.overwrite ? 'EDIT_RECORDS' : null),
            always_approve: (a) => a.action === 'delete' || (a.action === 'write' && !!a.overwrite),
            preview: async (a) => ({
                title: a.action === 'delete' ? `Delete ${a.path} on ${this.pick(devices, a).name}` : `Replace ${a.path} on ${this.pick(devices, a).name}`,
                action_type: a.action === 'delete' ? 'DELETE_DATA' : 'EDIT_RECORDS',
                preview: { kind: 'tool', device: this.pick(devices, a).name, input: { action: a.action, path: a.path, content: typeof a.content === 'string' ? a.content.slice(0, 2000) : undefined } },
            }),
            timeout_ms: (_a, ctx) => (ctx.run.automation_run_id ? AUTOMATION_OFFLINE_WAIT_MS + USER_TIMEOUT_MS : USER_TIMEOUT_MS + 10_000),
            execute: async (a, ctx) => {
                const d = this.pick(devices, a);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { computer, ...req } = a;
                const verb = { list: 'list files in', search: 'search files in', read: 'read', write: 'save a file to', move: 'move a file in', delete: 'delete a file in' }[String(a.action)] ?? 'use files in';
                const res = await this.call(ctx, d, 'LOCAL_FILES', 'files', req, `${verb} ${a.path ? `"${String(a.path).split(/[\\/]/).pop()}"` : 'your allowed folders'}`, false);
                if (res?.action === 'read' && typeof res.content === 'string' && Buffer.byteLength(res.content) > INLINE_MAX_BYTES) {
                    const data = Buffer.from(res.content, res.encoding === 'base64' ? 'base64' : 'utf8');
                    const fileId = await this.storeLarge(ctx, String(res.path).split(/[\\/]/).pop() || 'file', res.mimetype || 'application/octet-stream', data);
                    return { output: { ...res, content: undefined, file_id: fileId, note: 'The file is larger than 1 MB, so it was saved to file storage. Use read_file with this file_id.' } };
                }
                return { output: res };
            },
        };
    }

    private lookAtScreen(devices: OnlineDevice[]): ToolDef {
        return {
            name: 'look_at_my_screen',
            description: "Take a picture of a window or screen the user picks on their own computer, ONLY when the user asks (e.g. \"what's this error?\"). The user sees a picker each time and can cancel.",
            parameters: obj({ reason: { type: 'string', description: 'Shown in the picker: why you want to look' }, ...this.computerParam(devices) }, ['reason']),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `Asking to see your screen on ${this.pick(devices, a).name}`,
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const d = this.pick(devices, a);
                const res = await this.call(ctx, d, 'SCREEN', 'screen', { reason: String(a.reason ?? '').slice(0, 200) }, `look at your screen: ${String(a.reason ?? '').slice(0, 120)}`, true);
                if (res?.cancelled) return { output: { cancelled: true, note: 'The user cancelled the picker. Do not ask again unless they want to.' } };
                return this.withImage(ctx, { captured: res?.name ?? 'screen' }, res?.image);
            },
        };
    }

    private clipboard(devices: OnlineDevice[]): ToolDef[] {
        return [
            {
                name: 'copy_to_clipboard',
                description: "Put text on the clipboard of the user's computer (\"copy the table\").",
                parameters: obj({ text: { type: 'string' }, ...this.computerParam(devices) }, ['text']),
                step_type: 'DEVICE_TOOL',
                runs_on: 'device',
                title: (a) => `Copying to the clipboard on ${this.pick(devices, a).name}`,
                timeout_ms: () => USER_TIMEOUT_MS + 10_000,
                execute: async (a, ctx) => ({ output: await this.call(ctx, this.pick(devices, a), 'CLIPBOARD', 'clipboard_write', { text: String(a.text ?? '').slice(0, 200_000) }, 'copy text to your clipboard', false) }),
            },
            {
                name: 'read_clipboard',
                description: "Read what is on the clipboard of the user's computer. Only when the user asks you to (\"use what I copied\").",
                parameters: obj({ ...this.computerParam(devices) }),
                step_type: 'DEVICE_TOOL',
                runs_on: 'device',
                title: (a) => `Reading the clipboard on ${this.pick(devices, a).name}`,
                timeout_ms: () => USER_TIMEOUT_MS + 10_000,
                execute: async (a, ctx) => ({ output: await this.call(ctx, this.pick(devices, a), 'CLIPBOARD', 'clipboard_read', {}, 'read your clipboard', false) }),
            },
        ];
    }

    private open(devices: OnlineDevice[]): ToolDef {
        return {
            name: 'open_on_computer',
            description: "Open a link, a file (inside the user's allowed folders) or an app on the user's computer (\"open the report\", \"open the deal in HubSpot\").",
            parameters: obj({ kind: { type: 'string', enum: ['url', 'path', 'app'] }, target: { type: 'string', description: 'The https link, the file path, or the app name' }, ...this.computerParam(devices) }, ['kind', 'target']),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `Opening ${String(a.target).slice(0, 60)} on ${this.pick(devices, a).name}`,
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => ({ output: await this.call(ctx, this.pick(devices, a), 'OPEN', 'open', { kind: a.kind, target: String(a.target ?? '').slice(0, 2000) }, `open ${String(a.target).slice(0, 80)}`, false) }),
        };
    }

    /** One tool per tool of each local tool server, labelled with the computer (§14.3 Local tool servers). */
    private async localServerTools(device: OnlineDevice): Promise<ToolDef[]> {
        const raw = await this.redis.client.get(this.redis.key(RedisKeys.deviceLocalTools(device.id)));
        if (!raw) return [];
        let list: LocalToolInfo[] = [];
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
        return list.slice(0, 60).map((t) => {
            const name = `local_${slug(t.serverName)}_${slug(t.name)}`.slice(0, 64);
            const params = t.inputSchema && typeof t.inputSchema === 'object' ? { ...t.inputSchema, type: 'object', properties: (t.inputSchema as any).properties ?? {} } : { type: 'object', properties: {} };
            return {
                name,
                description: `[${t.serverName} — on ${device.name}] ${t.description || t.name}`.slice(0, 1000),
                parameters: params,
                step_type: 'DEVICE_TOOL',
                runs_on: 'device',
                title: () => `${t.name} — ${t.serverName} on ${device.name}`,
                classify: (a) => classifyToolSlug(t.name, a ?? {}),
                timeout_ms: () => USER_TIMEOUT_MS + 10_000,
                execute: async (a, ctx) => ({ output: await this.call(ctx, device, 'LOCAL_TOOL_SERVERS', 'local_tool', { server_id: t.serverId, tool: t.name, args: a ?? {} }, `use ${t.name} (${t.serverName})`, false) }),
            } satisfies ToolDef;
        });
    }

    /**
     * Control my computer (§14.3): the first call shows the "Allow" card on that computer with the task and a screen
     * picker; after that each action runs inside the grant (30 minutes, this task only). Never in automations.
     */
    private controlComputer(devices: OnlineDevice[]): ToolDef {
        return {
            name: 'control_my_computer',
            description:
                "Use the apps on the user's own computer like a person (click, type, scroll, keys) to finish what they asked. Only when the user asked for it. The first call asks them to allow it on that computer (state the task). Start with action \"screenshot\". " +
                'Never type passwords, card numbers or two-step codes: stop and ask the user to type them. Agent Space, password managers, system settings and terminals are off-limits. ' +
                'Set "effect" honestly: sending, submitting, buying or deleting is shown to the user for approval first. Coordinates are pixels in the latest screenshot.',
            parameters: obj(
                {
                    action: { type: 'string', enum: ['screenshot', 'click', 'double_click', 'right_click', 'move', 'drag', 'type', 'key', 'scroll', 'wait'] },
                    task: { type: 'string', description: 'First call: what you will do, shown in the Allow card, e.g. "fill in the expense claim in FinanceApp"' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    to_x: { type: 'number' },
                    to_y: { type: 'number' },
                    text: { type: 'string', description: 'type: the text' },
                    keys: { type: 'string', description: 'key: e.g. "Enter", "Tab", "ctrl+c"' },
                    amount: { type: 'number', description: 'scroll: lines, positive = down' },
                    ms: { type: 'number', description: 'wait: milliseconds (max 5000)' },
                    describe: { type: 'string', description: 'What you are clicking or typing into' },
                    effect: effectParam,
                    ...this.computerParam(devices),
                },
                ['action', 'effect'],
            ),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => (a.action === 'screenshot' ? `Looking at ${this.pick(devices, a).name}` : `${String(a.action).replace('_', ' ')}${a.describe ? ` ${String(a.describe).slice(0, 50)}` : ''} on ${this.pick(devices, a).name}`),
            classify: (a) => EFFECT_ACTION[String(a.effect)] ?? null,
            preview: async (a) => ({ title: `${String(a.action).replace('_', ' ')} "${a.describe ?? ''}" on ${this.pick(devices, a).name}`, action_type: EFFECT_ACTION[String(a.effect)] ?? 'OTHER', preview: { kind: 'tool', device: this.pick(devices, a).name, input: { action: a.action, describe: a.describe, text: a.text } } }),
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const d = this.pick(devices, a);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { computer, effect, describe, ...req } = a;
                const task = String(a.task || ctx.run.title || 'help with what you asked').slice(0, 200);
                const res = await this.call(ctx, d, 'CONTROL_COMPUTER', 'control', { ...req, task }, `control this computer to: ${task}`, true);
                if (res?.denied) return { output: { denied: true, note: 'The user did not allow it. Do not try again unless they ask.' } };
                if (res?.error) return this.withImage(ctx, { ok: false, error: res.error, front_app: res.frontApp ?? null }, res.screenshot);
                if (res?.screenshot?.dataUrl) {
                    const png = Buffer.from(String(res.screenshot.dataUrl).split(',')[1] ?? '', 'base64');
                    if (png.length) await this.storeReplayFrame(ctx, png).catch((e) => this.logger.warn(`Replay frame: ${(e as Error).message}`));
                }
                return this.withImage(ctx, { ok: true, front_app: res?.frontApp ?? null }, res?.screenshot);
            },
        };
    }

    // ------------------------------------------------------------------ phone tools (§14.3 Mobile tools)

    private phoneParam(phones: OnlineDevice[]) {
        return phones.length > 1 ? { phone: { type: 'string', enum: phones.map((d) => d.name), description: `Which phone. Default: "${phones[0].name}".` } } : {};
    }

    private scan(phones: OnlineDevice[]): ToolDef {
        return {
            name: 'scan_with_phone',
            description: "Ask the user to take a photo or scan a document with their phone (receipts, business cards, contracts, whiteboards). The user always takes the picture. Returns the recognised text and the image.",
            parameters: obj({ mode: { type: 'string', enum: ['photo', 'document'] }, reason: { type: 'string', description: 'Shown to the user: what to photograph or scan' }, ...this.phoneParam(phones) }, ['mode', 'reason']),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `Asking for a ${a.mode === 'document' ? 'scan' : 'photo'} on ${this.pick(phones, a).name}`,
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const res = await this.call(ctx, this.pick(phones, a), 'CAMERA_SCANNER', MobileOps.SCAN, { mode: a.mode === 'document' ? 'document' : 'photo', reason: String(a.reason ?? '').slice(0, 200) }, `${a.mode === 'document' ? 'scan a document' : 'take a photo'}: ${String(a.reason ?? '').slice(0, 100)}`, true);
                if (res?.cancelled) return { output: { cancelled: true } };
                let file_id: string | undefined;
                if (res?.pdf_base64) file_id = await this.storeLarge(ctx, `scan-${Date.now()}.pdf`, 'application/pdf', Buffer.from(String(res.pdf_base64), 'base64'));
                return this.withImage(ctx, { text: String(res?.text ?? '').slice(0, 20_000), pages: res?.pages ?? 1, ...(file_id ? { file_id } : {}) }, res?.image ? { dataUrl: String(res.image), width: 0, height: 0 } : undefined);
            },
        };
    }

    private contacts(phones: OnlineDevice[]): ToolDef {
        return {
            name: 'search_phone_contacts',
            description: "Search the contacts on the user's phone for a name, number or email (\"text Anna I'm late\"). It can't read the whole address book.",
            parameters: obj({ query: { type: 'string' }, ...this.phoneParam(phones) }, ['query']),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `Searching contacts for "${String(a.query).slice(0, 40)}"`,
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const q = String(a.query ?? '').trim();
                if (q.length < 2) throw new Error('Search for at least 2 characters');
                return { output: await this.call(ctx, this.pick(phones, a), 'CONTACTS', MobileOps.CONTACTS_SEARCH, { query: q.slice(0, 100) }, `search your contacts for "${q.slice(0, 40)}"`, false) };
            },
        };
    }

    private sendViaApp(phones: OnlineDevice[]): ToolDef {
        return {
            name: 'send_via_phone_app',
            description: 'Prepare a text message, WhatsApp message, email or phone call and open it in that app on the phone with everything filled in. The user taps Send (or Call): you can never send through these apps yourself.',
            parameters: obj({ app: { type: 'string', enum: ['sms', 'whatsapp', 'email', 'call'] }, to: { type: 'string', description: 'Phone number (international format) or email address' }, subject: { type: 'string' }, body: { type: 'string' }, ...this.phoneParam(phones) }, ['app', 'to']),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => `Opening ${a.app === 'call' ? 'a call to' : `a ${a.app} to`} ${String(a.to).slice(0, 40)}`,
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const res = await this.call(ctx, this.pick(phones, a), 'SEND_VIA_APPS', MobileOps.SEND_VIA_APP, { app: a.app, to: String(a.to ?? '').slice(0, 200), subject: a.subject ? String(a.subject).slice(0, 300) : undefined, body: a.body ? String(a.body).slice(0, 4000) : undefined }, `open ${a.app === 'call' ? 'a call' : `a ${a.app} message`} to ${String(a.to).slice(0, 40)}`, false);
                return { output: { ...res, note: 'The app is open with everything filled in. The user still has to tap Send; do not say it was sent.' } };
            },
        };
    }

    private phoneCalendar(phones: OnlineDevice[]): ToolDef {
        return {
            name: 'phone_calendar',
            description: "Read events, or add an event or reminder, in the calendars on the user's phone (including personal and work calendars synced to the phone but not connected here). Adding follows the usual approval rules.",
            parameters: obj(
                {
                    action: { type: 'string', enum: ['list', 'create'] },
                    from: { type: 'string', description: 'list: ISO date-time' },
                    to: { type: 'string', description: 'list: ISO date-time' },
                    title: { type: 'string' },
                    start: { type: 'string', description: 'create: ISO date-time' },
                    end: { type: 'string', description: 'create: ISO date-time' },
                    location: { type: 'string' },
                    notes: { type: 'string' },
                    remind_minutes_before: { type: 'number', description: 'A reminder alert before the start' },
                    calendar: { type: 'string' },
                    ...this.phoneParam(phones),
                },
                ['action'],
            ),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: (a) => (a.action === 'create' ? `Adding "${String(a.title ?? '').slice(0, 40)}" to the phone calendar` : 'Checking the phone calendar'),
            classify: (a) => (a.action === 'create' ? 'EDIT_RECORDS' : null),
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => {
                const d = this.pick(phones, a);
                if (a.action === 'create') {
                    if (!a.title || !a.start || !a.end) throw new Error('title, start and end are needed');
                    return { output: await this.call(ctx, d, 'DEVICE_CALENDAR', MobileOps.CALENDAR_CREATE, { title: String(a.title).slice(0, 200), start: a.start, end: a.end, location: a.location, notes: a.notes, remind_minutes_before: a.remind_minutes_before, calendar: a.calendar }, `add "${String(a.title).slice(0, 40)}" to your calendar`, false) };
                }
                const from = a.from ?? new Date().toISOString();
                const to = a.to ?? new Date(Date.now() + 7 * 86400_000).toISOString();
                return { output: await this.call(ctx, d, 'DEVICE_CALENDAR', MobileOps.CALENDAR_LIST, { from, to }, 'read your calendar', false) };
            },
        };
    }

    private location(phones: OnlineDevice[]): ToolDef {
        return {
            name: 'phone_location',
            description: "Get the phone's current location once, when the user asks (\"cafés near me\"). Never tracks.",
            parameters: obj({ ...this.phoneParam(phones) }),
            step_type: 'DEVICE_TOOL',
            runs_on: 'device',
            title: () => 'Checking your location',
            timeout_ms: () => USER_TIMEOUT_MS + 10_000,
            execute: async (a, ctx) => ({ output: await this.call(ctx, this.pick(phones, a), 'LOCATION', MobileOps.LOCATION_CURRENT, {}, 'see where you are right now', false) }),
        };
    }

    /** Each control action keeps its screenshot for the activity feed and the replay (§14.3 Record). */
    private async storeReplayFrame(ctx: ToolContext, png: Buffer) {
        const id = newId();
        const path = `orgs/${ctx.organization_id}/replays/device/${ctx.run.id}/${id}`;
        await this.storage.write('FILES', path, png, 'image/png');
        await this.prisma.file.create({
            data: { id, organization_id: ctx.organization_id, uploaded_by_id: ctx.run.user_id, bucket: 'FILES', area: 'REPLAYS', object_path: path, filename: `control-${Date.now()}.png`, mimetype: 'image/png', size: BigInt(png.length), status: 'READY', conversation_id: ctx.conversation_id, run_id: ctx.run.id },
        });
    }

    /** Ends any control grant this run holds on the user's computers (run finished, stopped or failed). */
    async finishRun(runId: string, userId: string | null) {
        if (!userId) return;
        const devices = await this.prisma.device.findMany({ where: { user_id: userId, platform: 'DESKTOP' }, select: { id: true } });
        for (const d of devices) {
            if (!(await this.isOnline(d.id))) continue;
            const payload = { request_id: randomToken(16), device_id: d.id, tool: 'CONTROL_COMPUTER', op: 'end_control', args: {}, run_id: runId };
            await this.redis.client.publish(this.redis.key(RedisKeys.deviceChannel(d.id)), JSON.stringify(payload)).catch(() => undefined);
        }
    }
}
