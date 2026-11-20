import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket = require('ws');
import { Prisma, VoiceSessionEndReason } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import { redactValues } from '@/shared/utils/security/secret-detection.utils';
import { newId } from '@/shared/utils/security/crypto.utils';
import { StorageService } from '@/integrations/storage/storage.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { PromptBuilder } from '../agent/prompt.builder';
import { decideApproval, TAP_ONLY } from '../agent/approval-policy';
import { MessagePart, ToolContext, ToolDef } from '../agent/tools/tool.types';
import { ApprovalsService } from '../approvals/approvals.service';
import { MessageEventsService } from '../conversations/message-events.service';
import { RunsService } from '../runs/runs.service';
import { UsageService } from '../usage/usage.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { extractFollowUps } from '../agent/follow-ups.utils';
import { DEFAULT_VOICE_MODEL, VOICE_MODELS, type VoiceModelPrice } from './voice-models';

/** Voices offered for bots (§7.6 "Voices"). */
export const VOICES = [
    { id: 'marin', label: 'Marin', description: 'Warm, natural' },
    { id: 'cedar', label: 'Cedar', description: 'Calm, clear' },
    { id: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
    { id: 'ash', label: 'Ash', description: 'Confident' },
    { id: 'ballad', label: 'Ballad', description: 'Soft, expressive' },
    { id: 'coral', label: 'Coral', description: 'Bright, friendly' },
    { id: 'echo', label: 'Echo', description: 'Steady' },
    { id: 'sage', label: 'Sage', description: 'Gentle' },
    { id: 'shimmer', label: 'Shimmer', description: 'Light, upbeat' },
    { id: 'verse', label: 'Verse', description: 'Lively' },
] as const;
export const DEFAULT_VOICE = 'marin';

const SPEED = { SLOWER: 0.85, NORMAL: 1, FASTER: 1.2 } as const;
const MAX_MINUTES = { MIN_15: 15, MIN_30: 30, MIN_60: 60 } as const;
const SILENCE_MS = 2 * 60_000;
const MAX_OUTPUT = 8000;
/**
 * gpt-realtime has a 32k-token context. Tool schemas count against it on every response, and once instructions +
 * tools + output overflow it OpenAI fails each reply a few words in (status "failed", server_error). Above this
 * budget (~10k tokens of schemas) connected-app tools are reached through find_app_tools / use_app_tool instead.
 */
const DIRECT_TOOLS_BUDGET = 40_000;
const APP_TOOL_RESULTS = 4;
const VoiceGatewayTools = { FIND: 'find_app_tools', USE: 'use_app_tool' } as const;

const realtimeTool = (t: Pick<ToolDef, 'name' | 'description' | 'parameters'>) => ({ type: 'function', name: t.name, description: t.description.slice(0, 1024), parameters: t.parameters });

const gatewayTools = () => [
    realtimeTool({
        name: VoiceGatewayTools.FIND,
        description: 'Find tools for connected apps and tool servers (Gmail, Calendar, Slack, Linear, HubSpot…). Returns matching tool names with their arguments schema. Call this before use_app_tool.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'What you want to do, with the app name, e.g. "list Linear projects"' } }, required: ['query'], additionalProperties: false },
    }),
    realtimeTool({
        name: VoiceGatewayTools.USE,
        description: 'Run a connected-app tool found with find_app_tools. Same approvals as calling it directly.',
        parameters: { type: 'object', properties: { name: { type: 'string', description: 'Exact tool name' }, arguments: { type: 'object', description: 'Arguments matching the tool schema', additionalProperties: true } }, required: ['name', 'arguments'], additionalProperties: false },
    }),
];

/** Keyword match over tool names and descriptions; name hits weigh more. */
const searchTools = (tools: ToolDef[], query: string) => {
    const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    return tools
        .map((t) => {
            const name = t.name.toLowerCase();
            const desc = t.description.toLowerCase();
            const score = words.reduce((s, w) => s + (name.includes(w) ? 3 : 0) + (desc.includes(w) ? 1 : 0), 0);
            return { t, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, APP_TOOL_RESULTS)
        .map(({ t }) => ({ name: t.name, description: t.description.slice(0, 400), parameters: t.parameters }));
};

/**
 * Top-level argument check against the tool schema. Realtime models sometimes guess names ("to" instead of
 * Gmail's "recipient_email"); catching that here lets the model retry with the right fields instead of the
 * service failing with a vague error.
 */
const checkArgs = (schema: Record<string, unknown>, args: Record<string, unknown>): string | null => {
    const props = (schema.properties ?? {}) as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    const missing = required.filter((k) => args[k] === undefined || args[k] === null || args[k] === '');
    const unknown = Object.keys(props).length && schema.additionalProperties !== true ? Object.keys(args).filter((k) => !(k in props)) : [];
    if (!missing.length && !unknown.length) return null;
    return [missing.length ? `Missing required: ${missing.join(', ')}.` : '', unknown.length ? `Unknown arguments: ${unknown.join(', ')}.` : '', 'Call it again using exactly the parameter names in expected_parameters.']
        .filter(Boolean)
        .join(' ');
};

interface PendingApproval {
    approval_id: string;
    call_id: string;
    def: ToolDef;
    args: Record<string, unknown>;
    tap_only: boolean;
    title: string;
}

interface Live {
    id: string;
    ws: WebSocket;
    ctx: ToolContext;
    tools: Map<string, ToolDef>;
    /** Connected-app tools reached through find_app_tools / use_app_tool (empty when all tools are sent directly). */
    app_tools: ToolDef[];
    run_id: string;
    conversation_id: string;
    user_id: string;
    bot_id: string;
    org_id: string;
    bot_message: { id: string; parts: MessagePart[] } | null;
    pending: Map<string, PendingApproval>;
    /** When each spoken turn started (by Realtime item id), so the transcript sorts before the bot's reply. */
    spoken_at: Map<string, Date>;
    /** "runId:status" of start_task tasks already announced, so each state change is told once. */
    announced_tasks: Set<string>;
    last_activity: number;
    started_at: number;
    max_ms: number;
    warned: boolean;
    timer: NodeJS.Timeout;
    closing: boolean;
    usage: { input: number; output: number; cost: number };
    /** Prices of the voice model this session runs on. */
    price: VoiceModelPrice;
    seq: number;
    /** Realtime events are handled strictly in order (deltas, message creation). */
    queue: Promise<void>;
    /** §7.6 camera and screen sharing: allowed by the organisation, what is on now, and when the last picture arrived. */
    visual_allowed: boolean;
    visual: VisualKind | null;
    last_picture_at: number;
}

export const VisualKinds = { CAMERA: 'camera', SCREEN: 'screen' } as const;
export type VisualKind = (typeof VisualKinds)[keyof typeof VisualKinds];
/** A spoken message is marked as "with a picture" when one arrived within this window. */
const PICTURE_WINDOW_MS = 20_000;
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;

/**
 * Voice mode (§7.6). The browser talks to OpenAI Realtime over WebRTC; our API exchanges the SDP with the real key
 * (never sent to the client) and attaches a server-side "sideband" WebSocket to the same call. All tool calls run
 * here through the same tool layer, approval engine and activity logging as text chat. Transcripts are saved as
 * normal messages with source VOICE; audio is never stored.
 */
@Injectable()
export class VoiceService implements OnModuleDestroy {
    private readonly logger = new Logger(VoiceService.name);
    private readonly live = new Map<string, Live>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly events: EventsService,
        private readonly runner: AgentRunnerService,
        private readonly prompt: PromptBuilder,
        private readonly approvals: ApprovalsService,
        private readonly messageEvents: MessageEventsService,
        private readonly runs: RunsService,
        private readonly usage: UsageService,
        private readonly activity: ActivityService,
        private readonly storage: StorageService,
    ) { }

    onModuleDestroy() {
        for (const s of this.live.values()) void this.close(s.id, 'CONNECTION_LOST');
    }

    private get apiKey() {
        const k = this.config.get<string>('OPENAI_API_KEY');
        if (!k) throw new BadRequestException('Voice mode is not set up on this server');
        return k;
    }

    /** Platform default: the VOICE_MODEL env var when it names a supported model, else gpt-realtime-2.1. */
    private get defaultModel() {
        const env = this.config.get<string>('VOICE_MODEL');
        return env && VOICE_MODELS.some((m) => m.id === env) ? env : DEFAULT_VOICE_MODEL;
    }

    /** The organisation's choice (§13.4) wins over the platform default. */
    private modelFor(orgModel: string | null | undefined) {
        const id = orgModel && VOICE_MODELS.some((m) => m.id === orgModel) ? orgModel : this.defaultModel;
        return VOICE_MODELS.find((m) => m.id === id)!;
    }

    voices() {
        return { voices: VOICES, default: DEFAULT_VOICE };
    }

    models() {
        return { models: VOICE_MODELS.map(({ id, label, description }) => ({ id, label, description })), default: this.defaultModel };
    }

    private sampleCache = new Map<string, Buffer>();

    /** "Hear sample" (§7.6): a short spoken line in the chosen voice, cached in memory. */
    async sample(voice: string) {
        if (!VOICES.some((v) => v.id === voice)) throw new NotFoundException('Unknown voice');
        const cached = this.sampleCache.get(voice);
        if (cached) return cached;
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.config.get('VOICE_SAMPLE_MODEL') || 'gpt-4o-mini-tts', voice, input: 'Hi! This is how I sound. Ask me anything, and I can get things done while we talk.', response_format: 'mp3' }),
        });
        if (!res.ok) throw new BadRequestException('Could not create the sample');
        const buf = Buffer.from(await res.arrayBuffer());
        this.sampleCache.set(voice, buf);
        return buf;
    }

    // ---------------- Start ----------------

    async start(actor: Actor, dto: { conversation_id: string; bot_id?: string; sdp: string; input_mode?: 'HANDS_FREE' | 'PUSH_TO_TALK' }) {
        const conversation = await this.prisma.conversation.findFirst({
            where: { id: dto.conversation_id, organization_id: actor.organization_id, deleted_at: null, participants: { some: { user_id: actor.user_id, left_at: null } } },
            include: { participants: { where: { left_at: null }, include: { user: { select: { id: true, name: true, email: true } }, bot: { select: { id: true, name: true, description: true } } } } },
        });
        if (!conversation) throw new NotFoundException('Conversation not found');
        const botIds = conversation.participants.filter((p) => p.bot_id).map((p) => p.bot_id!);
        const botId = dto.bot_id && botIds.includes(dto.bot_id) ? dto.bot_id : (conversation.lead_bot_id ?? botIds[0]);
        if (!botId) throw new BadRequestException('There is no bot in this conversation');

        const [org, orgSettings, user, userSettings, bot, membership] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: actor.organization_id } }),
            this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: actor.user_id } }),
            this.prisma.userSettings.findUnique({ where: { user_id: actor.user_id } }),
            this.prisma.bot.findUniqueOrThrow({ where: { id: botId }, include: { approval_rules: true } }),
            this.prisma.organizationMember.findUniqueOrThrow({ where: { organization_id_user_id: { organization_id: actor.organization_id, user_id: actor.user_id } } }),
        ]);
        if (orgSettings && !orgSettings.voice_mode_enabled) throw new ForbiddenException('Voice mode is turned off for this organisation');
        if (orgSettings?.voice_mode_who === 'OWNERS_ADMINS' && membership.role === 'MEMBER') throw new ForbiddenException('Only Owners and Admins can use voice mode in this organisation');
        if (!bot.voice_mode_enabled) throw new ForbiddenException(`${bot.name} doesn't use voice mode`);
        if (bot.deleted_at) throw new NotFoundException('Bot not found');
        const limit = await this.usage.limitReached(actor.organization_id, actor.user_id, bot.id);
        if (limit) throw new ForbiddenException(limit);

        // One voice conversation at a time per user (§7.6).
        for (const s of this.live.values()) if (s.user_id === actor.user_id) await this.close(s.id, 'USER_EXIT');

        const voice = userSettings?.voice_override || bot.voice || DEFAULT_VOICE;
        const inputMode = dto.input_mode ?? userSettings?.voice_input_mode ?? 'HANDS_FREE';
        const vs = await this.prisma.voiceSession.create({ data: { organization_id: actor.organization_id, conversation_id: conversation.id, user_id: actor.user_id, bot_id: bot.id, input_mode: inputMode, voice } });
        const run = await this.prisma.run.create({
            data: { organization_id: actor.organization_id, conversation_id: conversation.id, bot_id: bot.id, user_id: actor.user_id, type: 'CHAT_REPLY', status: 'RUNNING', started_at: new Date(), title: 'Voice conversation', voice_session_id: vs.id, state: {} },
        });

        const voiceModel = this.modelFor(orgSettings?.voice_model);
        const visualAllowed = orgSettings?.voice_visual_input !== false;
        const live: Partial<Live> = { visual_allowed: visualAllowed, visual: null, last_picture_at: 0, price: voiceModel.price, id: vs.id, bot_message: null, pending: new Map(), spoken_at: new Map(), announced_tasks: new Set(), usage: { input: 0, output: 0, cost: 0 }, seq: 0, queue: Promise.resolve() };
        const ctx: ToolContext = {
            run,
            bot,
            user,
            user_settings: userSettings,
            org_settings: orgSettings,
            organization_id: actor.organization_id,
            actor: { user_id: actor.user_id, organization_id: actor.organization_id, role: membership.role },
            conversation_id: conversation.id,
            is_temporary: conversation.is_temporary,
            supports_vision: true,
            secrets_used: [],
            addPart: async (part) => {
                const msg = await this.ensureBotMessage(live as Live);
                msg.parts.push(part);
                await this.saveBotMessage(live as Live);
            },
        };
        const { tools: toolDefs, summary } = await this.runner.buildTools(ctx);
        const voiceTools = this.voiceTools(live as Live);
        const all = [...toolDefs, ...voiceTools];
        const tools = new Map(all.map((t) => [t.name, t]));
        const appTools = toolDefs.filter((t) => t.connectionFor);
        const deferApps = appTools.length > 0 && JSON.stringify(all.map(realtimeTool)).length > DIRECT_TOOLS_BUDGET;
        live.app_tools = deferApps ? appTools : [];
        const exposed = deferApps ? [...all.filter((t) => !t.connectionFor).map(realtimeTool), ...gatewayTools()] : all.map(realtimeTool);

        // Spoken replies can't show follow-up chips, so the "[[followups: …]]" line would be read out loud.
        const voiceUserSettings = { ...(userSettings ?? {}), suggested_follow_ups: false } as NonNullable<typeof userSettings>;
        const pctx = { run, bot, user, user_settings: voiceUserSettings, org_settings: orgSettings, org_name: org.name, conversation, connection_summary: summary, supports_vision: true, ...(await this.runner.computerPrompt(ctx, tools)) };
        const system = await this.prompt.system(pctx);
        const history = await this.prompt.history(pctx, { excludeMessageIds: [], limit: 24, vision: false });
        const transcript = history
            .map((m) => `${m.role === 'assistant' ? bot.name : 'User'}: ${typeof m.content === 'string' ? m.content : (m.content as { type: string; text?: string }[]).filter((c) => c.type === 'text').map((c) => c.text).join(' ')}`)
            .join('\n')
            .slice(-12_000);
        const instructions = [
            system,
            `## Voice mode\nYou are now talking with ${user.name ?? 'the user'} out loud, in real time. You are the same bot with the same tools, rules and approvals as in text chat.\n` +
            `- Keep spoken replies short and conversational (one to three sentences). Never read out URLs, tables, code or long lists: put long content in the chat with your tools (e.g. create_document or show_ui) and say "I've put it in the chat".\n` +
            `- You can only change or do things by calling a tool. Never say something is done, changed, saved or sent unless a tool call in this conversation returned success. Requests to change yourself (your name, emoji, colour, instructions, model) are real, permanent changes: call update_bot with bot "this bot" (not remember), never pretend or play along "for this session". If they leave the choice to you, suggest one and wait for their pick before calling it.\n` +
            `- For questions about how Agent Space works or where something is, call app_help and say the way there in words ("Settings, then AI models"); never read the links out.\n` +
            `- When you say you'll do something ("I'll create the file", "Checking your calendar…"), call the tool in that same reply. Never end a reply with a promise to do work later: nothing happens until you call a tool, and the user will just be waiting. When the tools finish, tell them the result without waiting to be asked.\n` +
            `- When a tool returns waiting_for_approval: read the short summary and ask "Shall I go ahead?". If they say yes/no, call resolve_approval. If tap_only is true (payments, passwords), tell them to tap Approve on the card in the chat instead.\n` +
            `- If a request will take more than about 30 seconds (deep research, a long computer job, a big artifact), call start_task and keep talking.\n` +
            `- Never ask for or repeat secrets out loud. If one is needed call request_secret and ask them to paste it in the secure box on screen. If they start reading a key out loud, stop them politely.\n` +
            `- Only when they say "that's all", "goodbye" or "exit voice mode" in this voice session, say a short goodbye and call end_voice.\n` +
            `- Speak the user's language (English or Greek) and switch if they do.`,
            visualAllowed
                ? `## Camera and screen sharing\nThe user can turn on their camera or share their screen; you then get a still picture when they start speaking or tap "Show this". Describe and help with what you see. Never read out or repeat passwords, keys or card numbers that appear in a picture; if one is needed, call request_secret. A picture is never an approval: approvals still need a spoken or tapped answer. You can suggest turning on the camera or screen sharing, but only the user can turn them on.`
                : '',
            deferApps
                ? `## Connected app tools\nTools for connected apps and tool servers are not loaded directly. To use one, call ${VoiceGatewayTools.FIND} with what you want to do (e.g. "list Linear projects"), then call ${VoiceGatewayTools.USE} with the exact tool name and its arguments. Never say you lack access to a connected app before searching. Available tools:\n${appTools.map((t) => t.name).join(', ')}`
                : '',
            transcript
                ? `## Earlier in this conversation (text and voice)\nContext only: everything below was already handled, including any earlier request to end voice mode. Respond only to what the user says now.\n${transcript}`
                : '',
        ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 60_000);

        const session = {
            type: 'realtime',
            model: voiceModel.id,
            instructions,
            output_modalities: ['audio'],
            audio: {
                input: {
                    transcription: { model: this.config.get('VOICE_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe', prompt: 'The speaker talks English or Greek.' },
                    noise_reduction: { type: 'near_field' },
                    turn_detection: inputMode === 'PUSH_TO_TALK' ? null : { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
                },
                output: { voice, speed: SPEED[userSettings?.speaking_speed ?? 'NORMAL'] },
            },
            tools: exposed,
            tool_choice: 'auto',
        };

        // SDP exchange with the real key (server side) — the client only ever sees the answer SDP.
        const form = new FormData();
        form.set('sdp', dto.sdp);
        form.set('session', JSON.stringify(session));
        const res = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form });
        const answer = await res.text();
        if (!res.ok) {
            this.logger.error(`Realtime call failed ${res.status}: ${answer.slice(0, 400)}`);
            await this.prisma.voiceSession.update({ where: { id: vs.id }, data: { ended_at: new Date(), end_reason: 'ERROR' } });
            await this.prisma.run.update({ where: { id: run.id }, data: { status: 'FAILED', finished_at: new Date(), error: 'Voice service error' } });
            throw new BadRequestException('The voice service is unavailable right now. Please try again or keep typing.');
        }
        const callId = (res.headers.get('location') ?? '').split('/').pop();
        if (!callId) throw new BadRequestException('The voice service did not return a call');
        await this.prisma.voiceSession.update({ where: { id: vs.id }, data: { provider_session_id: callId } });

        const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
        const maxMs = MAX_MINUTES[orgSettings?.voice_max_session ?? 'MIN_30'] * 60_000;
        Object.assign(live, {
            ws,
            ctx,
            tools,
            run_id: run.id,
            conversation_id: conversation.id,
            user_id: actor.user_id,
            bot_id: bot.id,
            org_id: actor.organization_id,
            last_activity: Date.now(),
            started_at: Date.now(),
            max_ms: maxMs,
            warned: false,
            closing: false,
            timer: setInterval(() => void this.tick(vs.id), 5000),
        });
        this.live.set(vs.id, live as Live);
        ws.on('message', (raw) => {
            const l = this.live.get(vs.id);
            if (!l) return;
            const text = raw.toString();
            // Tool calls can take a while; they run outside the queue so audio events keep flowing.
            if (text.includes('"response.function_call_arguments.done"')) {
                void this.onEvent(vs.id, text).catch((e) => this.logger.warn(`Voice tool call failed: ${(e as Error).message}`));
                return;
            }
            l.queue = l.queue.then(() => this.onEvent(vs.id, text)).catch((e) => this.logger.warn(`Voice event failed: ${(e as Error).message}`));
        });
        ws.on('close', () => void this.close(vs.id, 'CONNECTION_LOST'));
        ws.on('error', (e) => this.logger.warn(`Voice sideband error: ${e.message}`));
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'voice.started', target_type: 'conversation', target_id: conversation.id, run_id: run.id, metadata: { bot_id: bot.id, voice, model: voiceModel.id } });
        return { id: vs.id, sdp: answer, bot_id: bot.id, voice, input_mode: inputMode, max_minutes: maxMs / 60_000, visual_input_allowed: visualAllowed };
    }

    // ---------------- Voice-only tools ----------------

    private voiceTools(live: Live): ToolDef[] {
        return [
            {
                name: 'resolve_approval',
                description: 'Record the user\'s spoken answer to a pending approval (yes → approve, no → reject). Not allowed for payments or passwords — those need a tap.',
                parameters: { type: 'object', properties: { approval_id: { type: 'string' }, decision: { type: 'string', enum: ['approve', 'reject'] } }, required: ['approval_id', 'decision'], additionalProperties: false },
                step_type: 'APPROVAL',
                runs_on: 'server',
                title: (a) => (a.decision === 'approve' ? 'Approved by voice' : 'Rejected by voice'),
                execute: async (a) => ({ output: await this.resolveByVoice(live, String(a.approval_id), a.decision === 'approve' ? 'approve' : 'reject') }),
            },
            {
                name: 'start_task',
                description: 'Hand a long job (more than ~30 seconds: deep research, a long cloud computer job, a large artifact) to the task runner. It continues in this conversation with your normal model, and the user is notified when it finishes.',
                parameters: { type: 'object', properties: { request: { type: 'string', description: 'The full request, with all details the user gave' }, title: { type: 'string' } }, required: ['request'], additionalProperties: false },
                step_type: 'TOOL_CALL',
                runs_on: 'server',
                title: (a) => `Starting a task: ${String(a.title ?? a.request).slice(0, 60)}`,
                execute: async (a) => {
                    const msg = await this.prisma.message.create({
                        data: { organization_id: live.org_id, conversation_id: live.conversation_id, author_type: 'USER', author_user_id: live.user_id, source: 'VOICE', status: 'COMPLETED', content: String(a.request), parts: [{ type: 'text', text: String(a.request) }] },
                    });
                    await this.messageEvents.created(msg.id);
                    const run = await this.runs.start({ organization_id: live.org_id, conversation_id: live.conversation_id, bot_id: live.bot_id, user_id: live.user_id, type: 'TASK', title: String(a.title ?? a.request).slice(0, 120), trigger_message_id: msg.id });
                    await this.prisma.run.update({ where: { id: run.id }, data: { voice_session_id: live.id } });
                    return { output: { status: 'started', task_id: run.id, note: 'Tell the user you started it and will let them know when it is done.' } };
                },
            },
            {
                name: 'end_voice',
                description: 'End voice mode after saying goodbye (the user said "that\'s all", "goodbye" or "exit voice mode").',
                parameters: { type: 'object', properties: {}, additionalProperties: false },
                step_type: 'TOOL_CALL',
                runs_on: 'server',
                title: () => 'Ending voice mode',
                execute: async () => {
                    setTimeout(() => void this.close(live.id, 'USER_EXIT'), 4000);
                    return { output: { status: 'ending' } };
                },
            },
        ];
    }

    // ---------------- Realtime events ----------------

    private send(live: Live, event: Record<string, unknown>) {
        if (live.ws.readyState === WebSocket.OPEN) live.ws.send(JSON.stringify(event));
    }

    private async onEvent(id: string, raw: string) {
        const live = this.live.get(id);
        if (!live) return;
        const e = JSON.parse(raw) as Record<string, any>;
        switch (e.type) {
            case 'input_audio_buffer.speech_started':
            case 'input_audio_buffer.committed':
                live.last_activity = Date.now();
                if (e.item_id && !live.spoken_at.has(e.item_id)) live.spoken_at.set(String(e.item_id), new Date());
                break;
            case 'conversation.item.input_audio_transcription.completed': {
                live.last_activity = Date.now();
                const text = String(e.transcript ?? '').trim();
                // Transcription finishes after the bot has started replying; date the message from when the user spoke.
                const at = live.spoken_at.get(String(e.item_id));
                live.spoken_at.delete(String(e.item_id));
                if (text) await this.saveUserMessage(live, text, at);
                break;
            }
            case 'response.output_audio_transcript.delta':
            case 'response.output_text.delta': {
                live.last_activity = Date.now();
                const msg = await this.ensureBotMessage(live);
                let last = msg.parts[msg.parts.length - 1] as any;
                if (last?.type !== 'text') {
                    last = { type: 'text', text: '' };
                    msg.parts.push(last);
                }
                last.text += String(e.delta ?? '');
                if (++live.seq % 8 === 0) await this.saveBotMessage(live);
                break;
            }
            case 'response.function_call_arguments.done':
                live.last_activity = Date.now();
                await this.onToolCall(live, String(e.call_id), String(e.name), String(e.arguments ?? '{}'));
                break;
            case 'conversation.item.added':
            case 'conversation.item.created': {
                const content = Array.isArray(e.item?.content) ? (e.item.content as { type?: string }[]) : [];
                if (e.item?.role === 'user' && content.some((c) => c.type === 'input_image')) {
                    // Second check of the organisation setting (§7.6): pictures in a session where it's off are removed.
                    if (!live.visual_allowed) this.send(live, { type: 'conversation.item.delete', item_id: e.item.id });
                    else live.last_picture_at = Date.now();
                }
                break;
            }
            case 'response.done': {
                const u = e.response?.usage;
                if (u) this.addUsage(live, u);
                if (e.response?.status === 'failed') this.logger.warn(`Realtime response failed: ${JSON.stringify(e.response.status_details ?? {}).slice(0, 400)}`);
                if (live.bot_message) {
                    await this.finishBotMessage(live);
                }
                break;
            }
            case 'error':
                this.logger.warn(`Realtime error: ${JSON.stringify(e.error ?? e).slice(0, 300)}`);
                break;
        }
    }

    private addUsage(live: Live, u: any) {
        const inD = u.input_token_details ?? {};
        const outD = u.output_token_details ?? {};
        const cost =
            ((inD.audio_tokens ?? 0) * live.price.audio_in + ((inD.text_tokens ?? 0) + (inD.image_tokens ?? 0)) * live.price.text_in + (inD.cached_tokens ?? 0) * live.price.cached + (outD.audio_tokens ?? 0) * live.price.audio_out + (outD.text_tokens ?? 0) * live.price.text_out) / 1_000_000;
        live.usage.input += u.input_tokens ?? 0;
        live.usage.output += u.output_tokens ?? 0;
        live.usage.cost += cost;
    }

    private async onToolCall(live: Live, callId: string, name: string, rawArgs: string) {
        const def = live.tools.get(name);
        const reply = async (output: unknown, images?: string[]) => {
            let text = JSON.stringify(redactValues(output, live.ctx.secrets_used) ?? null);
            if (text.length > MAX_OUTPUT) text = `${text.slice(0, MAX_OUTPUT)}… [truncated]`;
            this.send(live, { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: text } });
            if (images?.length) this.send(live, { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: images.slice(0, 1).map((url) => ({ type: 'input_image', image_url: url })) } });
            this.send(live, { type: 'response.create' });
        };
        let args: Record<string, unknown> = {};
        try {
            args = rawArgs ? JSON.parse(rawArgs) : {};
        } catch {
            return reply({ error: 'The arguments were not valid JSON' });
        }
        if (name === VoiceGatewayTools.FIND) {
            const results = searchTools(live.app_tools, String(args.query ?? ''));
            return reply(results.length ? { tools: results } : { tools: [], note: 'No matching tool. Try other words, or check the tool list in your instructions.' });
        }
        if (name === VoiceGatewayTools.USE) {
            const target = live.app_tools.find((t) => t.name === String(args.name));
            if (!target) return reply({ error: `Unknown app tool ${String(args.name)}. Call ${VoiceGatewayTools.FIND} first.` });
            return this.runTool(live, callId, target, (args.arguments ?? {}) as Record<string, unknown>, reply);
        }
        if (!def) return reply({ error: `Unknown tool ${name}` });
        return this.runTool(live, callId, def, args, reply);
    }

    /** Approval engine, then execution — shared by direct calls and use_app_tool. */
    private async runTool(live: Live, callId: string, def: ToolDef, args: Record<string, unknown>, reply: (output: unknown, images?: string[]) => Promise<void>) {
        const invalid = checkArgs(def.parameters, args);
        if (invalid) return reply({ error: invalid, expected_parameters: def.parameters });

        // Approval engine — same rules as text chat (§11); app-management changes always confirm.
        if (def.name !== 'resolve_approval') {
            const action = def.confirm ? 'OTHER' : await def.classify?.(args, live.ctx);
            const decision = def.confirm || def.always_approve?.(args) ? { required: true } : decideApproval(action ?? null, live.ctx.bot, live.ctx.org_settings, { toolPermission: def.tool_permission });
            if (decision.required) {
                const preview = def.preview ? await def.preview(args, live.ctx).catch(() => ({ title: def.title(args, live.ctx), action_type: action ?? 'OTHER', preview: { kind: 'tool', input: args } })) : { title: def.title(args, live.ctx), action_type: action ?? 'OTHER', preview: { kind: 'tool', input: args } };
                const actionType = (preview as { action_type?: string }).action_type ?? action ?? 'OTHER';
                const tapOnly = TAP_ONLY.includes(actionType as never) || live.ctx.org_settings?.voice_approvals_enabled === false;
                const msg = await this.ensureBotMessage(live);
                const approval = await this.approvals.create({
                    organization_id: live.org_id,
                    run_id: live.run_id,
                    conversation_id: live.conversation_id,
                    message_id: msg.id,
                    bot_id: live.bot_id,
                    requested_from_id: live.user_id,
                    action_type: actionType as never,
                    title: preview.title,
                    preview: redactValues(preview.preview as Record<string, unknown>, live.ctx.secrets_used),
                    tool_call_id: callId,
                    requires_tap: tapOnly || (preview as { requires_tap?: boolean }).requires_tap,
                });
                msg.parts.push({ type: 'approval', approval_id: approval.id, title: approval.title, action_type: approval.action_type, preview: approval.preview as Record<string, unknown>, status: 'PENDING', requires_tap: approval.requires_tap, tool: def.name });
                await this.saveBotMessage(live);
                live.pending.set(approval.id, { approval_id: approval.id, call_id: callId, def, args, tap_only: approval.requires_tap, title: approval.title });
                return reply({ status: 'waiting_for_approval', approval_id: approval.id, summary: approval.title, tap_only: approval.requires_tap });
            }
        }
        const result = await this.execute(live, callId, def, args);
        return reply(result.output, result.images);
    }

    /** Runs a tool with a run step and activity-feed part, exactly like the text runner. */
    private async execute(live: Live, callId: string, def: ToolDef, args: Record<string, unknown>): Promise<{ output: unknown; images?: string[] }> {
        const title = def.title(args, live.ctx);
        const seq = await this.prisma.runStep.count({ where: { run_id: live.run_id } });
        const step = await this.prisma.runStep.create({ data: { run_id: live.run_id, sequence: seq + 1, type: def.step_type, status: 'RUNNING', title, tool_name: def.name, runs_on: 'SERVER', input: redactValues(args, live.ctx.secrets_used) as Prisma.InputJsonValue } });
        const msg = await this.ensureBotMessage(live);
        const part: MessagePart = { type: 'tool', call_id: callId, step_id: step.id, name: def.name, title, status: 'running', started_at: new Date().toISOString() };
        msg.parts.push(part);
        await this.saveBotMessage(live);
        try {
            const result = await Promise.race([def.execute(args, live.ctx), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('The tool took too long to respond')), 120_000))]);
            if ('wait' in result) {
                // Secure secret box / computer hand-off: shown in the chat; voice continues meanwhile.
                msg.parts.push(result.part);
                Object.assign(part, { status: 'done' });
                await this.prisma.runStep.update({ where: { id: step.id }, data: { status: 'COMPLETED', finished_at: new Date() } });
                await this.saveBotMessage(live);
                return { output: { status: 'shown_on_screen', note: result.part.type === 'computer_handoff' ? 'The take-control card is in the chat. Ask the user to tap Take control, and to say when they are done.' : 'The secure box is in the chat. Ask the user to paste it there (never out loud). When they say it is saved, continue (list_secrets shows it).' } };
            }
            const output = redactValues(result.output, live.ctx.secrets_used);
            await this.prisma.runStep.update({ where: { id: step.id }, data: { status: 'COMPLETED', finished_at: new Date(), duration_ms: Date.now() - step.started_at.getTime(), connection_id: result.connection_id, output: JSON.parse(JSON.stringify(output ?? null, (_k, v) => (typeof v === 'string' && v.length > 4000 ? `${v.slice(0, 4000)}…` : v))) as Prisma.InputJsonValue } });
            Object.assign(part, { status: 'done', duration_ms: Date.now() - step.started_at.getTime() });
            await this.saveBotMessage(live);
            return { output, images: result.images };
        } catch (e) {
            const message = redactValues((e as Error).message || 'Tool failed', live.ctx.secrets_used);
            await this.prisma.runStep.update({ where: { id: step.id }, data: { status: 'FAILED', finished_at: new Date(), error: message } });
            Object.assign(part, { status: 'error', error: message.slice(0, 300) });
            await this.saveBotMessage(live);
            return { output: { error: message } };
        }
    }

    private async resolveByVoice(live: Live, approvalId: string, decision: 'approve' | 'reject') {
        const p = live.pending.get(approvalId);
        if (!p) return { error: 'That approval is not pending in this voice conversation' };
        if (p.tap_only && decision === 'approve') return { status: 'needs_tap', note: 'Payments, passwords and organisation-enforced approvals need a tap on the Approve button in the chat.' };
        await this.approvals.resolve({ user_id: live.user_id, organization_id: live.org_id, role: live.ctx.actor!.role }, approvalId, decision, undefined, true);
        live.pending.delete(approvalId);
        await this.markApproval(live, approvalId, decision === 'approve' ? 'APPROVED' : 'REJECTED');
        if (decision === 'reject') return { status: 'rejected', note: 'Acknowledge briefly; do not retry unless asked.' };
        const r = await this.execute(live, p.call_id, p.def, p.args);
        return { status: 'approved_and_done', result: r.output };
    }

    private async markApproval(live: Live, approvalId: string, status: string) {
        const row = await this.prisma.message.findFirst({ where: { run_id: live.run_id, parts: { array_contains: [{ approval_id: approvalId }] } } }).catch(() => null);
        const target = live.bot_message?.parts.some((p) => p.approval_id === approvalId) ? live.bot_message : row ? { id: row.id, parts: row.parts as MessagePart[] } : null;
        if (!target) return;
        for (const part of target.parts) if (part.type === 'approval' && part.approval_id === approvalId) part.status = status;
        await this.prisma.message.update({ where: { id: target.id }, data: { parts: target.parts as unknown as Prisma.InputJsonValue } });
        await this.messageEvents.publish(target.id);
    }

    /** Approvals tapped in the chat resolve the same pending call (§7.6). */
    private async checkTappedApprovals(live: Live) {
        if (!live.pending.size) return;
        const rows = await this.prisma.approval.findMany({ where: { id: { in: [...live.pending.keys()] }, status: { not: 'PENDING' } } });
        for (const a of rows) {
            const p = live.pending.get(a.id)!;
            live.pending.delete(a.id);
            await this.markApproval(live, a.id, a.status);
            let note: string;
            if (a.status === 'APPROVED' || a.status === 'EDITED_APPROVED') {
                const args = a.status === 'EDITED_APPROVED' && a.edited_payload ? { ...p.args, ...(a.edited_payload as object) } : p.args;
                const r = await this.execute(live, `${p.call_id}-tap`, p.def, args);
                note = `The user tapped Approve for "${p.title}". Result: ${JSON.stringify(r.output).slice(0, 3000)}. Tell them briefly.`;
            } else note = `The approval "${p.title}" was ${a.status.toLowerCase()}. Acknowledge briefly.`;
            this.send(live, { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: note }] } });
            this.send(live, { type: 'response.create' });
        }
    }

    /** Long jobs handed off with start_task: when one ends during the session, the bot says so (§7.6 "Long jobs"). */
    private async announceFinishedTasks(live: Live) {
        const runs = await this.prisma.run.findMany({
            where: { voice_session_id: live.id, type: 'TASK', status: { in: ['COMPLETED', 'FAILED', 'STOPPED', 'WAITING_APPROVAL', 'WAITING_INPUT'] } },
            select: { id: true, title: true, status: true, error: true },
        });
        for (const run of runs) {
            const key = `${run.id}:${run.status}`;
            if (live.announced_tasks.has(key)) continue;
            live.announced_tasks.add(key);
            const reply = await this.prisma.message.findFirst({ where: { run_id: run.id, author_type: 'BOT' }, orderBy: { created_at: 'desc' }, select: { content: true } });
            const result = (reply?.content ?? '').slice(0, 2000);
            const note =
                run.status === 'COMPLETED'
                    ? `The task "${run.title}" just finished. Its reply in the chat: ${result || '(no text)'}. Tell the user briefly that it's done and point them to the chat for the details.`
                    : run.status === 'WAITING_APPROVAL' || run.status === 'WAITING_INPUT'
                      ? `The task "${run.title}" is waiting for the user (${run.status === 'WAITING_APPROVAL' ? 'an approval' : 'an answer'} in the chat). Tell them briefly.`
                      : `The task "${run.title}" ${run.status === 'STOPPED' ? 'was stopped' : `failed: ${run.error ?? 'unknown error'}`}. Tell the user briefly.`;
            live.last_activity = Date.now();
            this.send(live, { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: note }] } });
            this.send(live, { type: 'response.create' });
        }
    }

    // ---------------- Messages ----------------

    private async saveUserMessage(live: Live, text: string, createdAt?: Date) {
        const msg = await this.prisma.message.create({
            data: {
                organization_id: live.org_id,
                conversation_id: live.conversation_id,
                author_type: 'USER',
                author_user_id: live.user_id,
                source: 'VOICE',
                status: 'COMPLETED',
                content: text,
                // Spoken with a picture (§7.6): the chat shows a small camera or screen icon on it.
                parts: [{ type: 'text', text }, ...(live.visual && Date.now() - live.last_picture_at < PICTURE_WINDOW_MS ? [{ type: 'visual', kind: live.visual }] : [])],
                ...(createdAt ? { created_at: createdAt } : {}),
            },
        });
        await this.messageEvents.created(msg.id);
        await this.touchConversation(live);
    }

    /** The voice bar tells the server whether the camera or screen sharing is on, to label spoken messages. */
    setVisual(actor: Actor, id: string, kind: VisualKind | null) {
        const live = this.requireOwn(actor, id);
        if (kind && !live.visual_allowed) throw new ForbiddenException('Camera and screen sharing are turned off for this organisation');
        live.visual = kind;
        return { ok: true, visual: kind };
    }

    /** Snapshot (§7.6): posts the current picture into the chat as an image, kept like any other attachment. */
    async snapshot(actor: Actor, id: string, dataUrl: string) {
        const live = this.requireOwn(actor, id);
        if (!live.visual_allowed) throw new ForbiddenException('Camera and screen sharing are turned off for this organisation');
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!m) throw new BadRequestException('Send a JPEG, PNG or WebP picture');
        const data = Buffer.from(m[2], 'base64');
        if (!data.length || data.length > MAX_SNAPSHOT_BYTES) throw new BadRequestException('The picture is too large');
        const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
        const label = live.visual === VisualKinds.SCREEN ? 'Screen snapshot' : 'Camera snapshot';
        const fileId = newId();
        const path = `orgs/${live.org_id}/chat/${fileId}`;
        await this.storage.write('FILES', path, data, m[1]);
        await this.prisma.file.create({
            data: { id: fileId, organization_id: live.org_id, uploaded_by_id: live.user_id, bucket: 'FILES', area: 'CHAT', object_path: path, filename: `${label.toLowerCase().replace(' ', '-')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, mimetype: m[1], size: BigInt(data.length), status: 'READY', conversation_id: live.conversation_id },
        });
        const msg = await this.prisma.message.create({
            data: { organization_id: live.org_id, conversation_id: live.conversation_id, author_type: 'USER', author_user_id: live.user_id, source: 'VOICE', status: 'COMPLETED', content: label, parts: [{ type: 'text', text: label }, { type: 'visual', kind: live.visual ?? VisualKinds.CAMERA }], files: { create: [{ file_id: fileId }] } },
        });
        await this.messageEvents.created(msg.id);
        await this.touchConversation(live);
        return { ok: true, message_id: msg.id, file_id: fileId };
    }

    private async ensureBotMessage(live: Live) {
        if (live.bot_message) return live.bot_message;
        const msg = await this.prisma.message.create({
            data: { organization_id: live.org_id, conversation_id: live.conversation_id, author_type: 'BOT', author_bot_id: live.bot_id, source: 'VOICE', status: 'STREAMING', parts: [], run_id: live.run_id },
        });
        live.bot_message = { id: msg.id, parts: [] };
        await this.messageEvents.created(msg.id);
        return live.bot_message;
    }

    private async saveBotMessage(live: Live, done = false) {
        const m = live.bot_message;
        if (!m) return;
        const parts = done ? m.parts.filter((p) => !(p.type === 'text' && !String(p.text ?? '').trim())) : m.parts;
        const content = parts.filter((p) => p.type === 'text').map((p) => String(p.text ?? '')).join('\n\n').trim();
        await this.prisma.message.update({ where: { id: m.id }, data: { parts: parts as unknown as Prisma.InputJsonValue, content: content || null, ...(done ? { status: 'COMPLETED' } : {}) } });
        await this.messageEvents.publish(m.id);
        if (done) await this.touchConversation(live);
    }

    /** Completes the current bot message, or removes it when the response produced nothing to show. */
    private async finishBotMessage(live: Live) {
        const m = live.bot_message!;
        live.bot_message = null;
        const hasContent = m.parts.some((p) => p.type !== 'text' || String(p.text ?? '').trim());
        if (!hasContent) {
            await this.prisma.message.delete({ where: { id: m.id } }).catch(() => undefined);
            await this.events.toConversation(live.conversation_id, ConversationEvents.MESSAGE_DELETED, { id: m.id, conversation_id: live.conversation_id });
            return;
        }
        // Voice sessions aren't asked for "[[followups: …]]", but if the model writes one anyway, show it as chips.
        const { parts, followUps } = extractFollowUps(m.parts);
        m.parts = parts;
        if (followUps.length && live.ctx.user_settings?.suggested_follow_ups !== false) m.parts.push({ type: 'follow-ups', items: followUps });
        live.bot_message = m;
        await this.saveBotMessage(live, true);
        live.bot_message = null;
    }

    private async touchConversation(live: Live) {
        await this.prisma.conversation.update({ where: { id: live.conversation_id }, data: { last_message_at: new Date(), message_count: { increment: 1 } } });
        const users = await this.prisma.conversationParticipant.findMany({ where: { conversation_id: live.conversation_id, user_id: { not: null }, left_at: null }, select: { user_id: true } });
        await this.events.toUsers(users.map((u) => u.user_id!), UserEvents.CONVERSATIONS_CHANGED, { conversation_id: live.conversation_id });
    }

    // ---------------- Typed text, limits, end ----------------

    /** A message typed while voice mode is on goes into the Realtime session as text (§7.6). */
    async text(actor: Actor, id: string, text: string) {
        const live = this.requireOwn(actor, id);
        await this.saveUserMessage(live, text);
        live.last_activity = Date.now();
        this.send(live, { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
        this.send(live, { type: 'response.create' });
        return { ok: true };
    }

    private requireOwn(actor: Actor, id: string) {
        const live = this.live.get(id);
        if (!live || live.user_id !== actor.user_id) throw new NotFoundException('This voice conversation has ended');
        return live;
    }

    async end(actor: Actor, id: string) {
        const live = this.live.get(id);
        if (live && live.user_id !== actor.user_id) throw new NotFoundException('Voice conversation not found');
        await this.close(id, 'USER_EXIT');
        return { ok: true };
    }

    status(actor: Actor, id: string) {
        const live = this.requireOwn(actor, id);
        return { id, active: true, started_at: new Date(live.started_at).toISOString(), max_minutes: live.max_ms / 60_000 };
    }

    private async tick(id: string) {
        const live = this.live.get(id);
        if (!live || live.closing) return;
        const now = Date.now();
        await this.checkTappedApprovals(live).catch((e) => this.logger.warn(`Approval check failed: ${(e as Error).message}`));
        await this.announceFinishedTasks(live).catch((e) => this.logger.warn(`Task check failed: ${(e as Error).message}`));
        if (now - live.last_activity > SILENCE_MS && !live.pending.size) return this.close(id, 'SILENCE');
        if (!live.warned && now - live.started_at > live.max_ms - 60_000) {
            live.warned = true;
            this.send(live, { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Tell the user briefly that voice mode will end in one minute (the organisation\'s maximum session length).' }] } });
            this.send(live, { type: 'response.create' });
        }
        if (now - live.started_at > live.max_ms) return this.close(id, 'MAX_LENGTH');
        if (live.usage.cost > 0 && now % 60_000 < 5000) {
            const limit = await this.usage.limitReached(live.org_id, live.user_id, live.bot_id);
            if (limit) return this.close(id, 'USAGE_LIMIT');
        }
    }

    async close(id: string, reason: VoiceSessionEndReason) {
        const live = this.live.get(id);
        if (!live || live.closing) return;
        live.closing = true;
        clearInterval(live.timer);
        this.live.delete(id);
        try {
            if (live.ws.readyState === WebSocket.OPEN || live.ws.readyState === WebSocket.CONNECTING) live.ws.close();
        } catch { /* already closed */ }
        if (live.bot_message) await this.finishBotMessage(live).catch(() => undefined);
        const seconds = Math.round((Date.now() - live.started_at) / 1000);
        await this.prisma.voiceSession.update({ where: { id }, data: { ended_at: new Date(), end_reason: reason, audio_seconds: seconds, input_tokens: live.usage.input, output_tokens: live.usage.output, cost: new Prisma.Decimal(live.usage.cost) } });
        await this.prisma.run.update({ where: { id: live.run_id }, data: { status: 'COMPLETED', finished_at: new Date(), input_tokens: live.usage.input, output_tokens: live.usage.output, cost: new Prisma.Decimal(live.usage.cost) } });
        await this.prisma.approval.updateMany({ where: { id: { in: [...live.pending.keys()] }, status: 'PENDING' }, data: { status: 'CANCELLED', resolved_at: new Date() } });
        await this.usage.record({ organization_id: live.org_id, user_id: live.user_id, bot_id: live.bot_id, run_id: live.run_id, kind: 'VOICE_MINUTES', quantity: Math.max(1, Math.round(seconds / 60)), cost: live.usage.cost, model_openrouter_id: null });
        await this.events.toUser(live.user_id, UserEvents.VOICE_ENDED, { voice_session_id: id, reason });
        await this.activity.log({ organization_id: live.org_id, actor_user_id: live.user_id, action: 'voice.ended', target_type: 'conversation', target_id: live.conversation_id, run_id: live.run_id, metadata: { reason, seconds, cost: live.usage.cost } });
    }
}
