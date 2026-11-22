import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OpenRouterService } from '@/integrations/openrouter/openrouter.service';
import { randomToken } from '@/shared/utils/security/crypto.utils';
import { WEB_SEARCH_MODEL } from '../../catalog/catalog.data';
import { BotsService } from '../../bots/bots.service';
import { UpdateBotDto } from '../../bots/dto/bot.dto';
import { UsersService } from '../../users/users.service';
import { UpdateUserSettingsDto } from '../../users/dto/user.dto';
import { CredentialsService } from '../../connections/credentials.service';
import { SecretInputKinds } from '../../connections/dto/connection.dto';
import { SkillsService } from '../../skills/skills.service';
import { FilesService } from '../../files/files.service';
import { UsageService } from '../../usage/usage.service';
import { ModelsService } from '../../catalog/models.service';
import { AccessService } from '../../access/access.service';
import { fetchReadable } from './web.utils';
import { appGuide, AppGuideTopics } from '../app-guide';
import { obj, ToolContext, ToolDef } from './tool.types';

const UI_BLOCK_TYPES = ['heading', 'text', 'card', 'stats', 'table', 'chart', 'list', 'checklist', 'progress', 'buttons', 'form', 'tabs', 'image', 'kv', 'callout', 'divider'];

const UI_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'Short title for the interactive reply' },
        blocks: {
            type: 'array',
            description:
                'Building blocks, rendered with the app design system. Types: heading{text}; text{markdown}; card{title,body,footer?}; stats{items:[{label,value,delta?,trend?:"up"|"down"}]}; table{columns:[string],rows:[[cell]]}; chart{kind:"bar"|"line"|"area"|"pie",data:[object],x:string,series:[string]}; list{items:[string],ordered?}; checklist{items:[{label,done,owner?,due?}]}; progress{label,value,max}; buttons{id,actions:[{label,value}]}; form{id,fields:[{name,label,type:"text"|"textarea"|"number"|"email"|"date"|"select"|"checkbox",options?:[string],required?,placeholder?}],submit_label}; tabs{tabs:[{label,blocks:[...]}]}; image{url,alt}; kv{items:[{label,value}]}; callout{tone:"info"|"success"|"warning"|"error",text}; divider{}.',
            items: { type: 'object', properties: { type: { type: 'string', enum: UI_BLOCK_TYPES } }, required: ['type'] },
        },
        fallback_text: { type: 'string', description: 'Plain-text version of the same content (accessibility, old clients)' },
    },
    required: ['title', 'blocks', 'fallback_text'],
};


@Injectable()
export class BuiltinToolsService {
    private readonly logger = new Logger(BuiltinToolsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly openrouter: OpenRouterService,
        private readonly bots: BotsService,
        private readonly users: UsersService,
        private readonly credentials: CredentialsService,
        private readonly skills: SkillsService,
        private readonly files: FilesService,
        private readonly usage: UsageService,
        private readonly models: ModelsService,
        private readonly access: AccessService,
        private readonly config: ConfigService,
    ) { }

    tools(ctx: ToolContext): ToolDef[] {
        const t: ToolDef[] = [];
        const org = ctx.org_settings;
        const bot = ctx.bot;

        if (bot.web_search_enabled && org?.builtin_web_search !== false) t.push(this.webSearch());
        t.push(this.readWebpage(), this.appHelp());
        if (bot.memory_enabled && !ctx.is_temporary && ctx.user_settings?.memory_enabled !== false) t.push(this.remember(), this.forget());
        const ui = org?.interactive_replies_mode !== 'OFF' && bot.interactive_replies_mode !== 'OFF' && ctx.user_settings?.interactive_replies !== false;
        if (ui) t.push(this.showUi());
        if (bot.document_creation_enabled && org?.builtin_document_creation !== false && ctx.conversation_id) t.push(this.createDocument());
        if (ctx.actor) {
            t.push(this.requestSecret(), this.listSecrets(), this.updateSecret(), this.deleteSecret());
            t.push(this.listBots(), this.updateBot(), this.updateMySettings(), this.listModels());
            t.push(this.loadSkill(), this.listSkills(), this.createSkill(), this.updateSkill(), this.assignSkill());
            if (bot.can_ask_other_bots && org?.bots_consulting_enabled !== false) t.push(this.askBot());
        }
        return t;
    }

    // ---------------- App help ----------------

    /** How Agent Space works, with direct links — loaded only when the user asks about the app. */
    private appHelp(): ToolDef {
        return {
            name: 'app_help',
            description:
                'How Agent Space itself works: features, where each page and setting is, and direct links to them. Call it whenever the user asks how to do something in the app, where a setting is, or what a feature does — never guess screens. Include the returned links in your reply as Markdown links.',
            parameters: obj({ topic: { type: 'string', enum: Object.values(AppGuideTopics), description: 'Pick the closest topic; "overview" lists every page' } }, ['topic']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Checking how Agent Space works',
            execute: async (a) => ({ output: appGuide(a.topic, this.config.get<string>('APP_URL') || '') }),
        };
    }

    // ---------------- Web ----------------

    private webSearch(): ToolDef {
        return {
            name: 'web_search',
            description: 'Search the live web. Returns an answer with source links. Use for anything current or factual you are not sure about.',
            parameters: obj({ query: { type: 'string', description: 'What to search for' } }, ['query']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: (a) => `Searching the web for "${String(a.query).slice(0, 60)}"`,
            execute: async (a, ctx) => {
                const res = await this.openrouter.complete({ model: WEB_SEARCH_MODEL, messages: [{ role: 'user', content: String(a.query) }], maxTokens: 1200 });
                await this.usage.record({ organization_id: ctx.organization_id, user_id: ctx.run.user_id, bot_id: ctx.bot.id, run_id: ctx.run.id, model_openrouter_id: WEB_SEARCH_MODEL, input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens, cost: res.usage.cost });
                const sources = (res.citations ?? []).filter((c) => c.url).slice(0, 8);
                if (sources.length && ctx.user_settings?.show_sources !== false) await ctx.addPart({ type: 'sources', sources });
                return { output: { answer: res.content, sources } };
            },
        };
    }

    private readWebpage(): ToolDef {
        return {
            name: 'read_webpage',
            description: 'Open a public web page and read its text content.',
            parameters: obj({ url: { type: 'string', description: 'Full http(s) URL' } }, ['url']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: (a) => {
                try {
                    return `Opening ${new URL(String(a.url)).hostname}`;
                } catch {
                    return 'Opening a web page';
                }
            },
            execute: async (a) => ({ output: await fetchReadable(String(a.url)) }),
        };
    }

    // ---------------- Memory (§6.3) ----------------

    private remember(): ToolDef {
        return {
            name: 'remember',
            description: 'Save a useful long-term fact or preference about the user or their work (e.g. "Prefers short emails", "Fiscal year starts in April"). Do not store secrets.',
            parameters: obj({ fact: { type: 'string', description: 'One short fact' } }, ['fact']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Remembering that',
            execute: async (a, ctx) => {
                const fact = String(a.fact).slice(0, 500);
                const shared = ctx.bot.memory_scope === 'SHARED';
                const m = await this.prisma.memory.create({
                    data: {
                        organization_id: ctx.organization_id,
                        kind: shared ? 'BOT_SHARED' : 'BOT_USER',
                        bot_id: ctx.bot.id,
                        user_id: ctx.run.user_id,
                        content: fact,
                        source_conversation_id: ctx.conversation_id,
                    },
                });
                return { output: { saved: true, memory_id: m.id } };
            },
        };
    }

    private forget(): ToolDef {
        return {
            name: 'forget',
            description: 'Delete a remembered fact the user asks you to forget. Pass the memory_id shown in your memory list.',
            parameters: obj({ memory_id: { type: 'string' } }, ['memory_id']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Forgetting that',
            execute: async (a, ctx) => {
                const res = await this.prisma.memory.deleteMany({ where: { id: String(a.memory_id), organization_id: ctx.organization_id, bot_id: ctx.bot.id, OR: [{ user_id: ctx.run.user_id }, { kind: 'BOT_SHARED' }] } });
                return { output: { deleted: res.count > 0 } };
            },
        };
    }

    // ---------------- Interactive replies (§7.4) ----------------

    private showUi(): ToolDef {
        return {
            name: 'show_ui',
            description:
                'Show an interactive reply built from ready-made building blocks (cards, tables, charts, stats, forms, checklists, buttons, tabs). Use it when a visual or interactive answer helps: dashboards, comparisons, plans, forms to collect input, choices to click. Form submissions and button clicks come back to you as a new message.',
            parameters: UI_SCHEMA,
            step_type: 'MESSAGE',
            runs_on: 'server',
            title: (a) => `Building "${String(a.title ?? 'interactive reply').slice(0, 50)}"`,
            execute: async (a, ctx) => {
                const blocks = (Array.isArray(a.blocks) ? a.blocks : []).filter((b: any) => b && UI_BLOCK_TYPES.includes(b.type)).slice(0, 40);
                const id = `ui_${randomToken(6)}`;
                await ctx.addPart({ type: 'ui', id, title: String(a.title ?? '').slice(0, 120), blocks, fallback_text: String(a.fallback_text ?? '').slice(0, 8000) });
                return { output: { shown: true, ui_id: id, note: 'The user can see it now. Do not repeat its content in text; add at most one short sentence.' } };
            },
        };
    }

    // ---------------- Files (§7.7) ----------------

    private createDocument(): ToolDef {
        return {
            name: 'create_document',
            description: 'Create a downloadable file for the user (report, notes, spreadsheet as CSV, web page as HTML, JSON data). The file appears in the chat.',
            parameters: obj(
                {
                    filename: { type: 'string', description: 'File name with extension, e.g. report.md, leads.csv' },
                    format: { type: 'string', enum: ['md', 'txt', 'csv', 'html', 'json'] },
                    content: { type: 'string', description: 'Full file content' },
                },
                ['filename', 'format', 'content'],
            ),
            step_type: 'FILE_WRITE',
            runs_on: 'server',
            title: (a) => `Writing ${String(a.filename).slice(0, 60)}`,
            execute: async (a, ctx) => {
                const mime = { md: 'text/markdown', txt: 'text/plain', csv: 'text/csv', html: 'text/html', json: 'application/json' }[a.format as string] ?? 'text/plain';
                const name = String(a.filename).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || `document.${a.format}`;
                const file = await this.files.saveGenerated({
                    organization_id: ctx.organization_id,
                    user_id: ctx.run.user_id,
                    conversation_id: ctx.conversation_id!,
                    run_id: ctx.run.id,
                    filename: name,
                    mimetype: mime,
                    data: Buffer.from(String(a.content), 'utf8'),
                });
                await ctx.addPart({ type: 'file', file_id: file.id, filename: file.filename, mimetype: file.mimetype, size: Number(file.size) });
                return { output: { file_id: file.id, filename: file.filename, size: Number(file.size) } };
            },
        };
    }

    // ---------------- Secrets (§8.8, §8.9) ----------------

    private requestSecret(): ToolDef {
        return {
            name: 'request_secret',
            description:
                'Show the secure secret box so the user can paste an API key or token, or save a website login (username, password, optional authenticator secret) for your cloud computer, safely. NEVER ask for keys or passwords in a normal message and never accept one typed in chat. You only get back the saved secret\'s name and a masked hint; use keys via call_api and website logins via computer_sign_in.',
            parameters: obj(
                {
                    purpose: { type: 'string', description: 'Why you need it, in one sentence' },
                    suggested_label: { type: 'string', description: 'e.g. "Mailchimp – Marketing"' },
                    service: { type: 'string', description: 'Service name, e.g. Mailchimp' },
                    kind: { type: 'string', enum: ['api_key', 'mcp_token', 'website_login', 'other'] },
                    website: { type: 'string', description: 'website_login only: the site, e.g. "portal.acme.com"' },
                    replace_credential_id: { type: 'string', description: 'Set to replace an existing secret' },
                },
                ['purpose', 'suggested_label', 'kind'],
            ),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Asking for a secret securely',
            execute: async (a, ctx) => {
                const request_id = `sec_${randomToken(8)}`;
                return {
                    wait: 'input',
                    request_id,
                    part: {
                        type: 'secret-input',
                        request_id,
                        run_id: ctx.run.id,
                        for_user_id: ctx.run.user_id,
                        for_user_name: ctx.user?.name ?? ctx.user?.email ?? 'Someone',
                        purpose: String(a.purpose).slice(0, 300),
                        suggested_label: String(a.suggested_label).slice(0, 80),
                        service: a.service ? String(a.service).slice(0, 60) : null,
                        kind: a.kind === SecretInputKinds.MCP_TOKEN ? SecretInputKinds.MCP_TOKEN : a.kind === SecretInputKinds.WEBSITE_LOGIN ? SecretInputKinds.WEBSITE_LOGIN : SecretInputKinds.API_KEY,
                        website: a.kind === SecretInputKinds.WEBSITE_LOGIN && a.website ? String(a.website).slice(0, 253) : null,
                        replace_credential_id: a.replace_credential_id ?? null,
                        bot_id: ctx.bot.id,
                        status: 'pending',
                    },
                };
            },
        };
    }

    private listSecrets(): ToolDef {
        return {
            name: 'list_secrets',
            description: 'List the secrets (API keys, tokens, website logins) the user can use: names, services, websites, masked hints and which bots may use them. Never returns values.',
            parameters: obj({}),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Checking your saved secrets',
            execute: async (_a, ctx) => ({ output: (await this.credentials.list(ctx.actor!, {})).map((c: any) => ({ id: c.id, label: c.label, service: c.service_name, kind: c.kind, website: c.website_domain ?? undefined, hint: c.masked_hint, visibility: c.visibility, status: c.status, bots: c.bots?.map((b: any) => b.name) })) }),
        };
    }

    private updateSecret(): ToolDef {
        return {
            name: 'update_secret',
            description: 'Rename a secret, change which bots may use it, or share/unshare it (Owners/Admins). Values can only be replaced with request_secret.',
            parameters: obj({
                credential_id: { type: 'string' },
                label: { type: 'string' },
                service_name: { type: 'string' },
                bot_names: { type: 'array', items: { type: 'string' }, description: 'Bots allowed to use it (replaces the list)' },
                visibility: { type: 'string', enum: ['PRIVATE', 'SHARED'] },
            }, ['credential_id']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: () => 'Updating a secret',
            preview: async (a, ctx) => {
                const c = await this.credentials.get(ctx.actor!, String(a.credential_id));
                return { title: `Update secret "${c.label}"`, action_type: 'OTHER', preview: { kind: 'change', target: c.label, changes: this.describeChanges({ label: a.label, service: a.service_name, bots: a.bot_names, sharing: a.visibility }) } };
            },
            execute: async (a, ctx) => {
                const bot_ids = a.bot_names ? await this.botIdsByName(ctx, a.bot_names) : undefined;
                const c = await this.credentials.updateMeta(ctx.actor!, String(a.credential_id), { label: a.label, service_name: a.service_name, bot_ids, visibility: a.visibility }, ctx.bot.id);
                return { output: { updated: true, label: c.label } };
            },
        };
    }

    private deleteSecret(): ToolDef {
        return {
            name: 'delete_secret',
            description: 'Delete a saved secret permanently (after the user confirms).',
            parameters: obj({ credential_id: { type: 'string' } }, ['credential_id']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: () => 'Deleting a secret',
            preview: async (a, ctx) => {
                const c = await this.credentials.get(ctx.actor!, String(a.credential_id));
                return { title: `Delete secret "${c.label}"`, action_type: 'DELETE_DATA', preview: { kind: 'change', target: c.label, changes: [{ field: 'Secret', to: 'Deleted permanently' }], warning: 'Bots that use it will ask for a new one next time.' } };
            },
            execute: async (a, ctx) => {
                await this.credentials.remove(ctx.actor!, String(a.credential_id));
                return { output: { deleted: true } };
            },
        };
    }

    // ---------------- App management by chat (§6.6, §13.5) ----------------

    private describeChanges(changes: Record<string, unknown>) {
        return Object.entries(changes)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([field, v]) => ({ field, to: Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v) }));
    }

    private async botIdsByName(ctx: ToolContext, names: string[]) {
        const bots = await this.prisma.bot.findMany({ where: this.access.usableBotsWhere(ctx.organization_id, ctx.actor!.user_id), select: { id: true, name: true } });
        return names.map((n) => {
            const b = bots.find((x) => x.name.toLowerCase() === String(n).toLowerCase()) ?? bots.find((x) => x.name.toLowerCase().includes(String(n).toLowerCase()));
            if (!b) throw new Error(`No bot called "${n}"`);
            return b.id;
        });
    }

    private async findBot(ctx: ToolContext, ref: string) {
        const bots = await this.prisma.bot.findMany({ where: this.access.usableBotsWhere(ctx.organization_id, ctx.actor!.user_id) });
        const r = String(ref).toLowerCase().trim();
        const bot =
            bots.find((b) => b.id === ref) ??
            bots.find((b) => b.name.toLowerCase() === r) ??
            bots.find((b) => b.name.toLowerCase().includes(r) || r.includes(b.name.toLowerCase())) ??
            (/(^|\b)(you|yourself|this bot)\b/.test(r) ? bots.find((b) => b.id === ctx.bot.id) : undefined);
        if (!bot) throw new Error(`No bot found matching "${ref}". Available: ${bots.map((b) => b.name).join(', ')}`);
        return bot;
    }

    private listBots(): ToolDef {
        return {
            name: 'list_bots',
            description: 'List the bots the user can use, with their model, description and skills.',
            parameters: obj({}),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Looking at your bots',
            execute: async (_a, ctx) => {
                const bots = await this.prisma.bot.findMany({
                    where: this.access.usableBotsWhere(ctx.organization_id, ctx.actor!.user_id),
                    include: { model: { select: { name: true } }, bot_skills: { include: { skill: { select: { name: true, slug: true } } } } },
                });
                return { output: bots.map((b) => ({ id: b.id, name: b.name, emoji: b.emoji, color: b.color, description: b.description, model: b.model?.name ?? 'Recommended', visibility: b.visibility, sensitive: b.is_sensitive, approval_level: b.approval_level, skills: b.bot_skills.map((s) => `/${s.skill.slug}`) })) };
            },
        };
    }

    private listModels(): ToolDef {
        return {
            name: 'list_models',
            description: 'List the AI models the user may pick for bots, with labels (fast, smart, writing, coding, vision) and cost tier.',
            parameters: obj({}),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Checking available models',
            execute: async (_a, ctx) => ({ output: (await this.models.listForOrg(ctx.organization_id)).filter((m) => m.allowed).map((m) => ({ id: m.id, name: m.name, provider: m.provider, labels: m.labels, cost: m.cost_tier, recommended: m.is_recommended })) }),
        };
    }

    private updateBot(): ToolDef {
        const COLORS: Record<string, string> = { grape: '#6B4EFF', purple: '#6B4EFF', violet: '#B18CFF', lavender: '#B18CFF', orange: '#FF7A3D', tangerine: '#FF7A3D', yellow: '#FFC83D', sunshine: '#FFC83D', green: '#1FC98E', mint: '#1FC98E', pink: '#FF5FAE', bubblegum: '#FF5FAE', blue: '#38B6FF', sky: '#38B6FF', lime: '#9BD62F', red: '#FF5A5F', coral: '#FF5A5F', teal: '#17B5B0', ocean: '#3A6BFF', navy: '#3A6BFF', grey: '#4A4560', gray: '#4A4560', graphite: '#4A4560' };
        return {
            name: 'update_bot',
            description:
                'Change a bot\'s settings when the user asks ("rename the marketing bot to Mia and make it purple", "make it more formal", "use a faster model", "always ask before sending emails"). The user sees a summary and must confirm. Cannot change security, billing or account settings.',
            parameters: obj({
                bot: { type: 'string', description: 'Bot name or id ("this bot" for yourself)' },
                name: { type: 'string' },
                shuffle_avatar: { type: 'boolean', description: 'Give the bot a new random portrait avatar' },
                color: { type: 'string', description: 'Colour name (grape, tangerine, sunshine, mint, bubblegum, sky, lime, coral, lavender, teal, ocean, graphite) or #hex' },
                description: { type: 'string' },
                instructions: { type: 'string', description: 'The FULL new instructions (rewrite, keeping what should stay)' },
                model: { type: 'string', description: 'Model name or id, or "recommended"' },
                approval_level: { type: 'string', enum: ['ALWAYS_ASK', 'IMPORTANT_ACTIONS', 'DONT_ASK'] },
                creativity: { type: 'string', enum: ['PRECISE', 'BALANCED', 'CREATIVE'] },
                web_search_enabled: { type: 'boolean' },
                memory_enabled: { type: 'boolean' },
                welcome_message: { type: 'string' },
            }, ['bot']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => `Updating ${a.bot}`,
            preview: async (a, ctx) => {
                const bot = await this.findBot(ctx, a.bot);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { bot: _b, ...changes } = a;
                if (changes.instructions) changes.instructions = `${String(changes.instructions).slice(0, 400)}${String(changes.instructions).length > 400 ? '…' : ''}`;
                return { title: `Update ${bot.name}`, action_type: 'OTHER', preview: { kind: 'change', target: bot.name, bot_id: bot.id, changes: this.describeChanges(changes) } };
            },
            execute: async (a, ctx) => {
                const bot = await this.findBot(ctx, a.bot);
                const dto: UpdateBotDto = {};
                if (a.shuffle_avatar) dto.avatar_seed = randomBytes(6).toString('hex');
                for (const k of ['name', 'description', 'instructions', 'approval_level', 'creativity', 'web_search_enabled', 'memory_enabled', 'welcome_message'] as const) if (a[k] !== undefined) (dto as any)[k] = a[k];
                if (a.color) {
                    const c = String(a.color).toLowerCase().trim();
                    dto.color = /^#[0-9a-f]{6}$/i.test(c) ? c : COLORS[c];
                    if (!dto.color) throw new Error(`Unknown colour "${a.color}"`);
                }
                if (a.model) {
                    const list = await this.models.listForOrg(ctx.organization_id);
                    const q = String(a.model).toLowerCase();
                    const m =
                        q === 'recommended'
                            ? list.find((x) => x.is_recommended)
                            : list.find((x) => x.id === a.model || x.name.toLowerCase() === q) ??
                            list.find((x) => x.name.toLowerCase().includes(q) || x.openrouter_id.includes(q)) ??
                            (q.includes('fast') ? list.find((x) => x.allowed && x.labels.includes('fast')) : q.includes('smart') ? list.find((x) => x.allowed && x.cost_tier === 'HIGH') : undefined);
                    if (!m) throw new Error(`Unknown model "${a.model}"`);
                    dto.model_id = m.id;
                }
                const errors = await validate(plainToInstance(UpdateBotDto, dto));
                if (errors.length) throw new Error(`Invalid change: ${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ')}`);
                const updated = await this.bots.update(ctx.actor!, bot.id, dto, 'chat');
                return { output: { updated: true, bot: { name: updated.name, color: updated.color, model: updated.model?.name } } };
            },
        };
    }

    private updateMySettings(): ToolDef {
        return {
            name: 'update_my_settings',
            description:
                'Change the user\'s personal settings when asked, e.g. reply_length (SHORT|BALANCED|DETAILED), reply_tone (CASUAL|FRIENDLY_PROFESSIONAL|FORMAL), emoji_usage (NONE|OCCASIONALLY|OFTEN), theme (SYSTEM|LIGHT|DARK), quiet_hours_enabled/quiet_hours_start/quiet_hours_end ("HH:MM"), suggested_follow_ups, show_sources, default_approval_level, send_with (ENTER|CTRL_ENTER), app_language (EN|EL). Security settings (password, email, 2FA, sign-in) can NOT be changed by chat — send the user to Settings.',
            parameters: { type: 'object', properties: { changes: { type: 'object', description: 'Setting name → new value' } }, required: ['changes'] },
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: () => 'Updating your settings',
            preview: async (a) => ({ title: 'Update your settings', action_type: 'OTHER', preview: { kind: 'change', target: 'Personal settings', changes: this.describeChanges(a.changes ?? {}) } }),
            execute: async (a, ctx) => {
                const changes = (a.changes ?? {}) as Record<string, unknown>;
                const banned = Object.keys(changes).filter((k) => /password|email|two_factor|phone|sign_in|security/i.test(k));
                if (banned.length) throw new Error('Security settings can only be changed in the Settings screens');
                const dto = plainToInstance(UpdateUserSettingsDto, changes);
                const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
                if (errors.length) throw new Error(`Invalid settings: ${errors.map((e) => e.property).join(', ')}`);
                await this.users.updateSettings(ctx.actor!.user_id, dto);
                return { output: { updated: Object.keys(changes) } };
            },
        };
    }

    // ---------------- Skills (§6.7) ----------------

    private loadSkill(): ToolDef {
        return {
            name: 'use_skill',
            description: 'Load the full step-by-step instructions of a skill before following it. Use when the request matches one of the skills listed in your instructions or the user mentions /skill-name.',
            parameters: obj({ slug: { type: 'string', description: 'Skill short name without the slash' } }, ['slug']),
            step_type: 'SKILL_USED',
            runs_on: 'server',
            title: (a) => `Using /${a.slug}`,
            execute: async (a, ctx) => {
                const s = await this.prisma.skill.findFirst({ where: { slug: String(a.slug).replace(/^\//, '').toLowerCase(), ...this.access.usableSkillsWhere(ctx.organization_id, ctx.actor!.user_id) } });
                if (!s) throw new Error(`No skill /${a.slug} you can use`);
                await ctx.addPart({ type: 'skill', skill_id: s.id, name: s.name, emoji: s.emoji, slug: s.slug });
                const assigned = await this.prisma.botSkill.count({ where: { bot_id: ctx.bot.id, skill_id: s.id } });
                const files = await this.prisma.skillFile.findMany({ where: { skill_id: s.id, file: { deleted_at: null, status: 'READY' } }, include: { file: { select: { id: true, filename: true, mimetype: true } } } });
                return {
                    output: {
                        name: s.name,
                        instructions: s.instructions,
                        questions_to_ask_first: s.questions,
                        required_tools: s.required_tools,
                        result: s.result,
                        files: files.length ? files.map((f) => ({ file_id: f.file.id, filename: f.file.filename, type: f.file.mimetype })) : undefined,
                        files_note: files.length ? 'These are the skill\'s templates/examples/guides. Read the ones you need with read_file.' : undefined,
                        assigned_to_you: assigned > 0,
                        note: assigned ? undefined : 'This skill is not assigned to you; after finishing, offer to add it permanently.',
                    },
                };
            },
        };
    }

    private listSkills(): ToolDef {
        return {
            name: 'list_skills',
            description: 'List skills the user can access and which bots have them.',
            parameters: obj({}),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Looking at skills',
            execute: async (_a, ctx) => {
                const rows = await this.prisma.skill.findMany({ where: this.access.usableSkillsWhere(ctx.organization_id, ctx.actor!.user_id), include: { bots: { include: { bot: { select: { name: true, organization_id: true } } } } }, take: 100 });
                return { output: rows.map((s) => ({ slug: s.slug, name: s.name, emoji: s.emoji, description: s.description, starter: s.is_starter, bots: s.bots.filter((b) => b.bot.organization_id === ctx.organization_id).map((b) => b.bot.name) })) };
            },
        };
    }

    private createSkill(): ToolDef {
        return {
            name: 'create_skill',
            description: 'Create a new reusable skill (also "turn what we just did into a skill"). The user reviews a summary and confirms before it is saved.',
            parameters: obj({
                name: { type: 'string' },
                emoji: { type: 'string' },
                description: { type: 'string', description: 'When the skill should be used' },
                instructions: { type: 'string', description: 'Numbered steps, rules and quality checks' },
                questions: { type: 'array', items: { type: 'string' }, description: 'Questions to ask first' },
                result: { type: 'string' },
                assign_to_bots: { type: 'array', items: { type: 'string' }, description: 'Bot names to give it to' },
            }, ['name', 'description', 'instructions']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => `Creating skill "${a.name}"`,
            preview: async (a) => ({ title: `Create skill ${a.emoji ? `${a.emoji} ` : ''}${a.name}`, action_type: 'OTHER', preview: { kind: 'skill', name: a.name, emoji: a.emoji, description: a.description, instructions: a.instructions, questions: a.questions, assign_to_bots: a.assign_to_bots } }),
            execute: async (a, ctx) => {
                const skill = await this.skills.create(ctx.actor!, {
                    name: a.name,
                    emoji: a.emoji,
                    description: a.description,
                    instructions: a.instructions,
                    questions: (a.questions ?? []).map((q: string, i: number) => ({ key: `q${i + 1}`, question: q, required: true })),
                    result: a.result,
                });
                if (a.assign_to_bots?.length) for (const id of await this.botIdsByName(ctx, a.assign_to_bots)) await this.skills.assign(ctx.actor!, skill.id, id, true);
                return { output: { created: true, slug: skill.slug, id: skill.id } };
            },
        };
    }

    private updateSkill(): ToolDef {
        return {
            name: 'update_skill',
            description: 'Edit, rename or delete an existing skill (creates a new version; deleted skills can be restored for 30 days). The user confirms first.',
            parameters: obj({
                slug: { type: 'string' },
                name: { type: 'string' },
                emoji: { type: 'string' },
                description: { type: 'string' },
                instructions: { type: 'string', description: 'The FULL new instructions' },
                delete: { type: 'boolean' },
                change_summary: { type: 'string' },
            }, ['slug']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => (a.delete ? `Deleting /${a.slug}` : `Updating /${a.slug}`),
            preview: async (a) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { slug, delete: del, ...changes } = a;
                return { title: del ? `Delete skill /${slug}` : `Update skill /${slug}`, action_type: del ? 'DELETE_DATA' : 'OTHER', preview: { kind: 'change', target: `/${slug}`, changes: del ? [{ field: 'Skill', to: 'Deleted (restorable for 30 days)' }] : this.describeChanges(changes) } };
            },
            execute: async (a, ctx) => {
                const s = await this.prisma.skill.findFirst({ where: { slug: String(a.slug).replace(/^\//, ''), organization_id: ctx.organization_id, deleted_at: null } });
                if (!s) throw new Error(`No editable skill /${a.slug} in this organisation`);
                if (a.delete) {
                    await this.skills.remove(ctx.actor!, s.id);
                    return { output: { deleted: true } };
                }
                const updated = await this.skills.update(ctx.actor!, s.id, { name: a.name, emoji: a.emoji, description: a.description, instructions: a.instructions, change_summary: a.change_summary ?? 'Edited by chat' });
                return { output: { updated: true, version: updated.current_version } };
            },
        };
    }

    private assignSkill(): ToolDef {
        return {
            name: 'assign_skill',
            description: 'Give a skill to a bot or remove it ("Give the Sales bot the client onboarding skill"). The user confirms first.',
            parameters: obj({ slug: { type: 'string' }, bot: { type: 'string' }, remove: { type: 'boolean' } }, ['slug', 'bot']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => `${a.remove ? 'Removing' : 'Giving'} /${a.slug} ${a.remove ? 'from' : 'to'} ${a.bot}`,
            preview: async (a, ctx) => {
                const bot = await this.findBot(ctx, a.bot);
                return { title: `${a.remove ? 'Remove' : 'Give'} /${a.slug} ${a.remove ? 'from' : 'to'} ${bot.name}`, action_type: 'OTHER', preview: { kind: 'change', target: bot.name, changes: [{ field: 'Skills', to: `${a.remove ? '−' : '+'} /${a.slug}` }] } };
            },
            execute: async (a, ctx) => {
                const bot = await this.findBot(ctx, a.bot);
                const s = await this.prisma.skill.findFirst({ where: { slug: String(a.slug).replace(/^\//, ''), ...this.access.usableSkillsWhere(ctx.organization_id, ctx.actor!.user_id) } });
                if (!s) throw new Error(`No skill /${a.slug}`);
                await this.skills.assign(ctx.actor!, s.id, bot.id, !a.remove);
                return { output: { ok: true } };
            },
        };
    }

    // ---------------- Bots working together (§6.5) ----------------

    private askBot(): ToolDef {
        return {
            name: 'ask_bot',
            description:
                'Ask another bot for information or help (e.g. ask the Sales bot what was promised to a client). It answers using its own knowledge and the conversations the current user is allowed to see. Always tell the user you asked it.',
            parameters: obj({ bot: { type: 'string', description: 'The other bot\'s name' }, question: { type: 'string' } }, ['bot', 'question']),
            step_type: 'BOT_CONSULTED',
            runs_on: 'server',
            title: (a) => `Asking ${a.bot}`,
            classify: async (a, ctx) => ((await this.findBot(ctx, a.bot)).is_sensitive ? ('CONSULT_SENSITIVE_BOT' as const) : null),
            preview: async (a, ctx) => {
                const target = await this.findBot(ctx, a.bot);
                return { title: `${ctx.bot.name} wants to ask ${target.name}`, action_type: 'CONSULT_SENSITIVE_BOT', preview: { kind: 'consult', from: ctx.bot.name, to: target.name, question: a.question } };
            },
            execute: async (a, ctx) => {
                const target = await this.findBot(ctx, a.bot);
                if (target.id === ctx.bot.id) throw new Error('You cannot ask yourself');
                if (!target.can_be_asked) throw new Error(`${target.name} does not accept questions from other bots`);
                const answer = await this.consult(ctx, target, String(a.question));
                await ctx.addPart({ type: 'consulted', bot: { id: target.id, name: target.name, avatar_seed: target.avatar_seed, color: target.color }, question: String(a.question).slice(0, 300) });
                return { output: { bot: target.name, answer } };
            },
        };
    }

    /** A bot-to-bot request: the other bot answers from its instructions, memory and the conversations this user can see. */
    private async consult(ctx: ToolContext, target: { id: string; name: string; instructions: string; model_id: string | null }, question: string) {
        const userId = ctx.actor!.user_id;
        const [memories, recent, resolved] = await Promise.all([
            this.prisma.memory.findMany({ where: { bot_id: target.id, OR: [{ user_id: userId, kind: 'BOT_USER' }, { kind: 'BOT_SHARED' }] }, take: 50, orderBy: { updated_at: 'desc' } }),
            this.prisma.message.findMany({
                where: {
                    deleted_at: null,
                    conversation: { organization_id: ctx.organization_id, deleted_at: null, is_temporary: false, AND: [{ participants: { some: { user_id: userId, left_at: null } } }, { participants: { some: { bot_id: target.id } } }] },
                    content: { not: null },
                },
                orderBy: { created_at: 'desc' },
                take: 60,
                include: { author_bot: { select: { name: true } }, author_user: { select: { name: true } }, conversation: { select: { name: true } } },
            }),
            this.models.resolve(ctx.organization_id, target.model_id),
        ]);
        const transcript = recent
            .reverse()
            .map((m) => `[${m.created_at.toISOString().slice(0, 16)}] ${m.author_bot?.name ?? m.author_user?.name ?? 'System'}: ${(m.content ?? '').slice(0, 800)}`)
            .join('\n');
        const child = await this.prisma.run.create({
            data: { organization_id: ctx.organization_id, conversation_id: null, bot_id: target.id, user_id: userId, type: 'BOT_TO_BOT', status: 'RUNNING', parent_run_id: ctx.run.id, requested_by_bot_id: ctx.bot.id, model_id: resolved.model.id, started_at: new Date(), title: question.slice(0, 200) },
        });
        try {
            const res = await this.openrouter.complete({
                model: resolved.model.openrouter_id,
                fallbackModels: resolved.fallbacks,
                maxTokens: 1500,
                messages: [
                    {
                        role: 'system',
                        content: `${target.instructions}\n\nAnother bot (${ctx.bot.name}) is asking you a question on behalf of ${ctx.user?.name ?? 'a user'}. Answer factually and concisely using only what you know below. If you don't know, say so.\n\nWhat you remember:\n${memories.map((m) => `- ${m.content}`).join('\n') || '(nothing)'}\n\nRecent conversations you were part of (that this user can see):\n${transcript || '(none)'}`,
                    },
                    { role: 'user', content: question },
                ],
            });
            await this.prisma.run.update({ where: { id: child.id }, data: { status: 'COMPLETED', finished_at: new Date(), input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens, cost: new Prisma.Decimal(res.usage.cost) } });
            await this.usage.record({ organization_id: ctx.organization_id, user_id: userId, bot_id: target.id, run_id: child.id, model_openrouter_id: res.model, input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens, cost: res.usage.cost });
            return res.content;
        } catch (e) {
            await this.prisma.run.update({ where: { id: child.id }, data: { status: 'FAILED', finished_at: new Date(), error: (e as Error).message.slice(0, 500) } });
            throw e;
        }
    }
}

