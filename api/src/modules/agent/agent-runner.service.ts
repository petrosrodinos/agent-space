import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RunStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService, HeldLock } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import { ChatMessage, ChatToolCall, ChatToolDef, OpenRouterService } from '@/integrations/openrouter/openrouter.service';
import { redactValues } from '@/shared/utils/security/secret-detection.utils';
import { ModelsService } from '../catalog/models.service';
import { MessageEventsService } from '../conversations/message-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsageService } from '../usage/usage.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { ActivityService } from '../activity/activity.service';
import { decideApproval } from './approval-policy';
import { PromptBuilder, TEMPERATURE } from './prompt.builder';
import { BuiltinToolsService } from './tools/builtin-tools.service';
import { ConnectionToolsService } from './tools/connection-tools.service';
import { AutomationToolsService } from './tools/automation-tools.service';
import { ArtifactToolsService } from './tools/artifact-tools.service';
import { KnowledgeToolsService } from './tools/knowledge-tools.service';
import { ComputerToolsService } from './tools/computer-tools.service';
import { McpToolsService } from './tools/mcp-tools.service';
import { AutomationsService } from '../automations/automations.service';
import { MessagePart, ToolContext, ToolDef } from './tools/tool.types';

const MAX_STEPS = 16;
const TOOL_TIMEOUT_MS = 120_000;
const MAX_TOOL_OUTPUT = 14_000;
const LOCK_TTL = 30_000;

export class LockBusyError extends Error { }

interface RunState {
    model_override_id?: string | null;
    branch_from_message_id?: string | null;
    message_id?: string;
    messages?: ChatMessage[];
    parts?: MessagePart[];
    pending?: { calls: ChatToolCall[]; index: number } | null;
    approval_for?: Record<string, string>;
    pending_input?: { request_id: string; call_id: string; for_user_id: string | null; part_index: number; step_id: string; result?: Record<string, any> } | null;
    seq?: number;
    model_openrouter_id?: string;
}

const FINAL: RunStatus[] = ['COMPLETED', 'FAILED', 'STOPPED'];

/**
 * Executes one bot run inside a queue worker (§14.4). Every step is persisted, live events go to the
 * conversation stream, and waiting for an approval or input saves state and frees the worker.
 */
@Injectable()
export class AgentRunnerService {
    private readonly logger = new Logger(AgentRunnerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly events: EventsService,
        private readonly openrouter: OpenRouterService,
        private readonly models: ModelsService,
        private readonly messageEvents: MessageEventsService,
        private readonly notifications: NotificationsService,
        private readonly usage: UsageService,
        private readonly approvals: ApprovalsService,
        private readonly activity: ActivityService,
        private readonly prompt: PromptBuilder,
        private readonly builtins: BuiltinToolsService,
        private readonly connectionTools: ConnectionToolsService,
        private readonly automationTools: AutomationToolsService,
        private readonly artifactTools: ArtifactToolsService,
        private readonly knowledgeTools: KnowledgeToolsService,
        private readonly computerTools: ComputerToolsService,
        private readonly mcpTools: McpToolsService,
        private readonly automations: AutomationsService,
    ) { }

    private cancelled(runId: string) {
        return this.redis.client.exists(this.redis.key(RedisKeys.runCancel(runId))).then((n) => n > 0);
    }

    async execute(runId: string) {
        const run = await this.prisma.run.findUnique({ where: { id: runId } });
        if (!run || FINAL.includes(run.status) || run.status.startsWith('WAITING')) return;

        let lock: HeldLock | null = null;
        let renew: NodeJS.Timeout | undefined;
        if (run.conversation_id) {
            lock = await this.redis.acquireLock(RedisKeys.convBotLock(run.conversation_id, run.bot_id), LOCK_TTL);
            if (!lock) throw new LockBusyError('Bot is still replying in this conversation');
            renew = setInterval(() => void this.redis.renewLock(lock!, LOCK_TTL), 10_000);
        }
        try {
            await this.loop(runId);
        } finally {
            if (renew) clearInterval(renew);
            await lock?.release();
        }
    }

    private async loop(runId: string) {
        const run = await this.prisma.run.findUniqueOrThrow({ where: { id: runId } });
        const state = (run.state ?? {}) as RunState;
        const [bot, user, userSettings, orgSettings, org, conversation] = await Promise.all([
            this.prisma.bot.findUniqueOrThrow({ where: { id: run.bot_id }, include: { approval_rules: true } }),
            run.user_id ? this.prisma.user.findUnique({ where: { id: run.user_id } }) : null,
            run.user_id ? this.prisma.userSettings.findUnique({ where: { user_id: run.user_id } }) : null,
            this.prisma.organizationSettings.findUnique({ where: { organization_id: run.organization_id } }),
            this.prisma.organization.findUniqueOrThrow({ where: { id: run.organization_id } }),
            run.conversation_id
                ? this.prisma.conversation.findUnique({
                    where: { id: run.conversation_id },
                    include: { participants: { where: { left_at: null }, include: { user: { select: { id: true, name: true, email: true } }, bot: { select: { id: true, name: true, description: true } } } } },
                })
                : null,
        ]);
        const membership = run.user_id ? await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: run.organization_id, user_id: run.user_id } } }) : null;

        // ---- First start: usage limits, bot message, initial prompt ----
        if (!state.message_id) {
            const limit = run.user_id ? await this.usage.limitReached(run.organization_id, run.user_id, bot.id) : null;
            if (bot.deleted_at || (run.user_id && !membership)) return this.fail(run.id, state, 'This bot is no longer available to you.');
            const message = await this.prisma.message.create({
                data: {
                    organization_id: run.organization_id,
                    conversation_id: run.conversation_id!,
                    author_type: 'BOT',
                    author_bot_id: bot.id,
                    source: 'BOT',
                    status: 'STREAMING',
                    parts: [],
                    run_id: run.id,
                    branch_from_message_id: state.branch_from_message_id ?? null,
                    branch_index: state.branch_from_message_id ? await this.prisma.message.count({ where: { branch_from_message_id: state.branch_from_message_id } }) + 1 : 0,
                },
            });
            state.message_id = message.id;
            state.parts = [];
            state.seq = 0;
            await this.messageEvents.created(message.id);
            if (limit) return this.fail(run.id, state, `${limit} Ask an Owner or Admin to raise it.`);
        }

        const resolved = await this.models.resolve(run.organization_id, state.model_override_id ?? bot.model_id);
        await this.prisma.run.update({ where: { id: run.id }, data: { status: 'RUNNING', started_at: run.started_at ?? new Date(), model_id: resolved.model.id } });
        await this.prisma.message.update({ where: { id: state.message_id }, data: { status: 'STREAMING', model_id: resolved.model.id } });
        await this.statusEvent(run, 'RUNNING');

        const ctx: ToolContext = {
            run,
            bot,
            user,
            user_settings: userSettings,
            org_settings: orgSettings,
            organization_id: run.organization_id,
            actor: membership && run.user_id ? { user_id: run.user_id, organization_id: run.organization_id, role: membership.role } : null,
            conversation_id: run.conversation_id,
            is_temporary: !!conversation?.is_temporary,
            supports_vision: !!resolved.model.supports_vision,
            secrets_used: [],
            addPart: async (part) => {
                state.parts!.push(part);
                await this.saveParts(state);
            },
        };

        const { tools: toolDefs, summary } = await this.buildTools(ctx);
        const tools = new Map(toolDefs.map((t) => [t.name, t]));
        const toolSchemas: ChatToolDef[] = toolDefs.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

        if (!state.messages) {
            const pctx = { run, bot, user, user_settings: userSettings, org_settings: orgSettings, org_name: org.name, conversation, connection_summary: summary, supports_vision: resolved.model.supports_vision };
            const system = await this.prompt.system(pctx);
            const history = await this.prompt.history(pctx, { excludeMessageIds: [state.message_id!, ...(state.branch_from_message_id ? [state.branch_from_message_id] : [])], vision: resolved.model.supports_vision });
            // Automation runs (§10.2): extra rules in the system prompt, and the run's instructions as the final turn.
            const automation = await this.automations.promptFor(run);
            if (automation) history.push({ role: 'user', content: automation.user });
            if (!history.length) return this.fail(run.id, state, 'There was nothing to reply to.');
            state.messages = [{ role: 'system', content: automation ? `${system}\n\n${automation.system}` : system }, ...history];
        }

        try {
            // ---- Resume a waiting tool call (input or approval) ----
            if (state.pending) {
                const waiting = await this.processToolCalls(ctx, state, tools);
                if (waiting) return;
            }

            for (let step = 0; step < MAX_STEPS; step++) {
                if (await this.cancelled(run.id)) return this.stop(run.id, state);
                if (run.deadline_at && Date.now() > run.deadline_at.getTime()) return this.fail(run.id, state, 'The maximum task duration for this bot was reached.');

                const textIndex = this.ensureTextPart(state);
                const flusher = this.deltaFlusher(run.conversation_id, state.message_id!, textIndex);
                const result = await this.openrouter.stream({
                    model: resolved.model.openrouter_id,
                    fallbackModels: resolved.fallbacks,
                    messages: state.messages!,
                    tools: toolSchemas,
                    temperature: TEMPERATURE[bot.creativity],
                    maxTokens: 8000,
                    onTextDelta: (d) => {
                        (state.parts![textIndex] as any).text += d;
                        flusher.push(d);
                    },
                });
                await flusher.flush();

                await this.recordUsage(run.id, ctx, result.model, result.usage);
                if (result.model && !result.model.startsWith(resolved.model.openrouter_id) && !state.parts!.some((p) => p.type === 'notice')) {
                    state.parts!.push({ type: 'notice', text: `${resolved.model.name} was unavailable, so I answered with ${result.model}.` });
                    await this.prisma.run.update({ where: { id: run.id }, data: { fallback_used: true } });
                }

                state.messages!.push({ role: 'assistant', content: result.content || null, ...(result.tool_calls.length ? { tool_calls: result.tool_calls } : {}) });
                await this.saveParts(state);

                if (!result.tool_calls.length) return this.complete(run.id, state, userSettings?.suggested_follow_ups !== false);

                state.pending = { calls: result.tool_calls, index: 0 };
                const waiting = await this.processToolCalls(ctx, state, tools);
                if (waiting) return;
            }
            // Too many steps: ask the model to wrap up once more without tools.
            const final = await this.openrouter.complete({ model: resolved.model.openrouter_id, messages: [...state.messages!, { role: 'user', content: 'Please summarise what you did and what is left, briefly.' }], maxTokens: 800 });
            const idx = this.ensureTextPart(state);
            (state.parts![idx] as any).text += final.content;
            await this.recordUsage(run.id, ctx, final.model, final.usage);
            return this.complete(run.id, state, false);
        } catch (e) {
            const msg = (e as Error).message || 'Something went wrong';
            this.logger.error(`Run ${run.id} failed: ${msg}`);
            return this.fail(run.id, state, /AI request failed|provider/i.test(msg) ? 'The AI service is temporarily unavailable. Please try again.' : msg.slice(0, 300));
        }
    }

    /** The bot's full tool set for this context — the same for text chat, tasks, automations and voice (§7.6). */
    async buildTools(ctx: ToolContext): Promise<{ tools: ToolDef[]; summary: string[] }> {
        let toolDefs: ToolDef[] = [...this.builtins.tools(ctx), ...this.automationTools.tools(ctx)];
        let summary: string[] = [];
        if (!ctx.is_temporary) toolDefs = [...toolDefs, ...(await this.artifactTools.tools(ctx))];
        toolDefs = [...toolDefs, ...(await this.knowledgeTools.tools(ctx)), ...(await this.computerTools.tools(ctx))];
        try {
            const conn = await this.connectionTools.tools(ctx);
            toolDefs = [...toolDefs, ...conn.tools];
            summary = conn.summary;
        } catch (e) {
            this.logger.warn(`Connection tools unavailable: ${(e as Error).message}`);
        }
        try {
            const mcp = await this.mcpTools.tools(ctx);
            toolDefs = [...toolDefs, ...mcp.tools];
            summary = [...summary, ...mcp.summary];
        } catch (e) {
            this.logger.warn(`Custom tool servers unavailable: ${(e as Error).message}`);
        }
        return { tools: toolDefs, summary };
    }

    private ensureTextPart(state: RunState) {
        const last = state.parts![state.parts!.length - 1];
        if (last?.type === 'text') return state.parts!.length - 1;
        state.parts!.push({ type: 'text', text: '' });
        return state.parts!.length - 1;
    }

    /** Batches text deltas (~60 ms) onto the conversation stream. */
    private deltaFlusher(conversationId: string | null, messageId: string, index: number) {
        let buf = '';
        let timer: NodeJS.Timeout | null = null;
        const send = async () => {
            timer = null;
            if (!buf || !conversationId) return;
            const delta = buf;
            buf = '';
            await this.events.toConversation(conversationId, ConversationEvents.MESSAGE_DELTA, { message_id: messageId, index, delta });
        };
        return {
            push: (d: string) => {
                buf += d;
                if (!timer) timer = setTimeout(() => void send(), 60);
            },
            flush: async () => {
                if (timer) clearTimeout(timer);
                await send();
            },
        };
    }

    /** Runs pending tool calls in order. Returns true when the run is now waiting (approval or input). */
    private async processToolCalls(ctx: ToolContext, state: RunState, tools: Map<string, ToolDef>): Promise<boolean> {
        const pending = state.pending!;
        state.approval_for ??= {};
        for (let i = pending.index; i < pending.calls.length; i++) {
            pending.index = i;
            const call = pending.calls[i];
            if (await this.cancelled(ctx.run.id)) {
                await this.stop(ctx.run.id, state);
                return true;
            }

            // Answer to an input request (secure secret box).
            if (state.pending_input?.call_id === call.id) {
                const pi = state.pending_input;
                if (!pi.result) return true;
                const r = pi.result;
                const part = state.parts![pi.part_index] as any;
                if (part?.type === 'computer_handoff') {
                    // The user handed the cloud computer back (or cancelled) — §9.2, §9.4.
                    const done = r.status === 'done';
                    Object.assign(part, { status: done ? 'done' : 'cancelled' });
                    const toolPart = state.parts!.find((p) => p.type === 'tool' && (p as any).call_id === call.id);
                    if (toolPart) Object.assign(toolPart, { status: done ? 'done' : 'stopped' });
                    await this.finishStep(pi.step_id, done ? 'COMPLETED' : 'SKIPPED', { status: r.status });
                    state.messages!.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(done ? { status: 'handed_back', note: 'The user finished and handed control back. Take a screenshot to see the current state, then continue.' + (r.note ? ` They said: ${String(r.note).slice(0, 300)}` : '') } : { status: 'cancelled', note: 'The user did not take control. Explain what you could not do.' }) });
                    state.pending_input = null;
                    await this.saveParts(state);
                    continue;
                }
                Object.assign(part, { status: r.status === 'saved' ? 'saved' : 'cancelled', saved: r.status === 'saved' ? { label: r.label, masked_hint: r.masked_hint, credential_id: r.credential_id } : null });
                const toolPart = state.parts!.find((p) => p.type === 'tool' && (p as any).call_id === call.id);
                if (toolPart) Object.assign(toolPart, { status: r.status === 'saved' ? 'done' : 'stopped' });
                await this.finishStep(pi.step_id, r.status === 'saved' ? 'COMPLETED' : 'SKIPPED', { status: r.status, label: r.label, masked_hint: r.masked_hint });
                state.messages!.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(r.status === 'saved' ? { status: 'saved', credential_id: r.credential_id, label: r.label, service: r.service, masked_hint: r.masked_hint } : { status: 'cancelled' }) });
                state.pending_input = null;
                await this.saveParts(state);
                continue;
            }

            const def = tools.get(call.function.name);
            let args: any = {};
            try {
                args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            } catch {
                state.messages!.push({ role: 'tool', tool_call_id: call.id, content: 'Error: the tool arguments were not valid JSON. Try again.' });
                continue;
            }
            if (!def) {
                state.messages!.push({ role: 'tool', tool_call_id: call.id, content: `Error: unknown tool ${call.function.name}` });
                continue;
            }

            // ---- Approval engine (§11, §13.1) ----
            const existingApproval = state.approval_for[call.id];
            if (existingApproval) {
                const a = await this.prisma.approval.findUnique({ where: { id: existingApproval } });
                if (!a || a.status === 'PENDING') return this.waitFor(ctx, state, 'WAITING_APPROVAL');
                const partIdx = state.parts!.findIndex((p) => p.type === 'approval' && p.approval_id === a.id);
                if (partIdx >= 0) (state.parts![partIdx] as any).status = a.status;
                if (a.status === 'REJECTED' || a.status === 'EXPIRED' || a.status === 'CANCELLED') {
                    state.messages!.push({ role: 'tool', tool_call_id: call.id, content: a.status === 'REJECTED' ? 'The user rejected this action. Do not retry it unless they ask; acknowledge briefly.' : `The approval was ${a.status.toLowerCase()}; the action was not performed.` });
                    await this.saveParts(state);
                    continue;
                }
                if (a.status === 'EDITED_APPROVED' && a.edited_payload) args = { ...args, ...(a.edited_payload as object) };
            } else {
                const action = def.confirm ? 'OTHER' : await def.classify?.(args, ctx);
                const preApproved = !def.confirm && ctx.run.automation_run_id ? await this.automations.isPreApproved(ctx.run, action ?? null, def.connectionFor?.(args), args) : false;
                const decision = def.confirm ? { required: true } : decideApproval(action ?? null, ctx.bot, ctx.org_settings, { preApproved });
                if (decision.required) {
                    let previewError: string | null = null;
                    const preview = def.preview
                        ? await def.preview(args, ctx).catch((e) => {
                            previewError = (e as Error).message;
                            return { title: `${def.name}`, action_type: action ?? 'OTHER', preview: { kind: 'tool', input: args, error: previewError } };
                        })
                        : { title: def.title(args, ctx), action_type: action ?? 'OTHER', preview: { kind: 'tool', input: args } };
                    // A confirm-only change that can't be applied as asked goes back to the model instead of showing a broken card.
                    if (previewError && def.confirm) {
                        state.messages!.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${previewError}` });
                        await this.saveParts(state);
                        continue;
                    }
                    const approval = await this.approvals.create({
                        organization_id: ctx.organization_id,
                        run_id: ctx.run.id,
                        conversation_id: ctx.conversation_id,
                        message_id: state.message_id!,
                        bot_id: ctx.bot.id,
                        requested_from_id: ctx.run.user_id,
                        action_type: (preview as any).action_type ?? action ?? 'OTHER',
                        title: preview.title,
                        preview: redactValues(preview.preview as Record<string, unknown>, ctx.secrets_used),
                        tool_call_id: call.id,
                        requires_tap: (preview as any).requires_tap,
                    });
                    state.approval_for[call.id] = approval.id;
                    state.parts!.push({ type: 'approval', approval_id: approval.id, title: approval.title, action_type: approval.action_type, preview: approval.preview as any, status: 'PENDING', requires_tap: approval.requires_tap, tool: def.name });
                    await this.saveParts(state);
                    return this.waitFor(ctx, state, 'WAITING_APPROVAL');
                }
            }

            // ---- Execute ----
            const seq = (state.seq = (state.seq ?? 0) + 1);
            const title = def.title(args, ctx);
            const step = await this.prisma.runStep.create({
                data: { run_id: ctx.run.id, sequence: seq, type: def.step_type, status: 'RUNNING', title, tool_name: def.name, runs_on: 'SERVER', input: redactValues(args, ctx.secrets_used) as Prisma.InputJsonValue },
            });
            const partIndex = state.parts!.push({ type: 'tool', call_id: call.id, step_id: step.id, name: def.name, title, status: 'running', started_at: new Date().toISOString() }) - 1;
            await this.saveParts(state);
            if (ctx.conversation_id) await this.events.toConversation(ctx.conversation_id, ConversationEvents.RUN_STEP, { run_id: ctx.run.id, step_id: step.id, title, status: 'RUNNING' });

            try {
                const result = await Promise.race([
                    def.execute(args, ctx),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The tool took too long to respond')), TOOL_TIMEOUT_MS)),
                ]);
                if ('wait' in result) {
                    const pIdx = state.parts!.push(result.part) - 1;
                    state.pending_input = { request_id: result.request_id, call_id: call.id, for_user_id: ctx.run.user_id, part_index: pIdx, step_id: step.id };
                    (state.parts![partIndex] as any).status = 'waiting';
                    await this.saveParts(state);
                    return this.waitFor(ctx, state, 'WAITING_INPUT');
                }
                const output = redactValues(result.output, ctx.secrets_used);
                let serialized = JSON.stringify(output ?? null);
                if (serialized.length > MAX_TOOL_OUTPUT) serialized = `${serialized.slice(0, MAX_TOOL_OUTPUT)}… [truncated]`;
                await this.prisma.runStep.update({
                    where: { id: step.id },
                    data: { status: 'COMPLETED', finished_at: new Date(), duration_ms: Date.now() - step.started_at.getTime(), output: JSON.parse(JSON.stringify(output ?? null, (_k, v) => (typeof v === 'string' && v.length > 4000 ? `${v.slice(0, 4000)}…` : v))) as Prisma.InputJsonValue, connection_id: result.connection_id },
                });
                Object.assign(state.parts![partIndex], { status: 'done', duration_ms: Date.now() - step.started_at.getTime() });
                state.messages!.push({ role: 'tool', tool_call_id: call.id, content: serialized });
                if ('images' in result && result.images?.length && ctx.supports_vision) this.pushImages(state, def.name, result.images);
            } catch (e) {
                const msg = redactValues((e as Error).message || 'Tool failed', ctx.secrets_used);
                await this.finishStep(step.id, 'FAILED', null, msg);
                Object.assign(state.parts![partIndex], { status: 'error', error: msg.slice(0, 300) });
                state.messages!.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${msg}` });
            }
            await this.saveParts(state);
            if (ctx.conversation_id) await this.events.toConversation(ctx.conversation_id, ConversationEvents.RUN_STEP, { run_id: ctx.run.id, step_id: step.id, title, status: (state.parts![partIndex] as any).status });
        }
        state.pending = null;
        await this.persistState(ctx.run.id, state);
        return false;
    }

    /** Shows tool images (screenshots) to the model; only the latest two stay in the context to keep it small. */
    private pushImages(state: RunState, tool: string, images: string[]) {
        let seen = 0;
        for (let i = state.messages!.length - 1; i >= 0; i--) {
            const m = state.messages![i] as any;
            if (m.role === 'user' && Array.isArray(m.content) && m.content[0]?.text?.startsWith('[Screenshot')) {
                seen++;
                if (seen >= 2) m.content = '[Screenshot from earlier — removed]';
            }
        }
        state.messages!.push({ role: 'user', content: [{ type: 'text', text: `[Screenshot after ${tool}]` }, ...images.slice(0, 2).map((url) => ({ type: 'image_url' as const, image_url: { url } }))] });
    }

    private async finishStep(stepId: string, status: 'COMPLETED' | 'FAILED' | 'SKIPPED', output: unknown, error?: string) {
        const s = await this.prisma.runStep.findUnique({ where: { id: stepId } });
        if (!s) return;
        await this.prisma.runStep.update({ where: { id: stepId }, data: { status, output: (output ?? undefined) as Prisma.InputJsonValue, error, finished_at: new Date(), duration_ms: Date.now() - s.started_at.getTime() } });
    }

    private async waitFor(ctx: ToolContext, state: RunState, status: 'WAITING_APPROVAL' | 'WAITING_INPUT') {
        await this.persistState(ctx.run.id, state, { status });
        await this.statusEvent(ctx.run, status);
        // Re-publish so clients see the run is waiting on the user, not working.
        await this.messageEvents.publish(state.message_id!);
        return true;
    }

    private async persistState(runId: string, state: RunState, extra: Prisma.RunUpdateInput = {}) {
        await this.prisma.run.update({ where: { id: runId }, data: { state: state as unknown as Prisma.InputJsonValue, ...extra } });
    }

    /** Messages are written to the database at the end of every step (§14.4), then a full snapshot is published. */
    private async saveParts(state: RunState) {
        const text = this.textOf(state);
        await this.prisma.message.update({ where: { id: state.message_id! }, data: { parts: state.parts as unknown as Prisma.InputJsonValue, content: text } });
        await this.messageEvents.publish(state.message_id!);
    }

    private textOf(state: RunState) {
        return (state.parts ?? [])
            .filter((p) => p.type === 'text')
            .map((p) => String((p as any).text ?? ''))
            .join('\n\n')
            .replace(/\[\[followups:[^\]]*\]\]/g, '')
            .trim();
    }

    private async recordUsage(runId: string, ctx: ToolContext, model: string, usage: { prompt_tokens: number; completion_tokens: number; cost: number }) {
        await this.prisma.run.update({
            where: { id: runId },
            data: { input_tokens: { increment: usage.prompt_tokens }, output_tokens: { increment: usage.completion_tokens }, cost: { increment: new Prisma.Decimal(usage.cost || 0) } },
        });
        await this.usage.record({ organization_id: ctx.organization_id, user_id: ctx.run.user_id, bot_id: ctx.bot.id, run_id: runId, model_openrouter_id: model, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, cost: usage.cost || 0 });
    }

    private async statusEvent(run: { id: string; bot_id: string; conversation_id: string | null; user_id: string | null; automation_run_id?: string | null }, status: RunStatus, extra: Record<string, unknown> = {}) {
        if (run.conversation_id) await this.events.toConversation(run.conversation_id, ConversationEvents.RUN_STATUS, { run_id: run.id, bot_id: run.bot_id, status, ...extra });
        if (run.user_id) await this.events.toUser(run.user_id, UserEvents.TASK_UPDATED, { run_id: run.id, status });
        // Automation run history, counters, retry and auto-pause (§10.5).
        if (run.automation_run_id) {
            await this.automations.recordRunOutcome(run.id, status, typeof extra.error === 'string' ? extra.error : null).catch((e) => this.logger.warn(`Automation outcome for run ${run.id}: ${(e as Error).message}`));
        }
    }

    private async complete(runId: string, state: RunState, withFollowUps: boolean) {
        // Pull "[[followups: a || b || c]]" into a follow-ups part.
        const followups: string[] = [];
        for (const p of state.parts ?? []) {
            if (p.type !== 'text') continue;
            const m = /\[\[followups:([^\]]*)\]\]/.exec(String((p as any).text));
            if (m) followups.push(...m[1].split('||').map((s) => s.trim()).filter(Boolean));
            (p as any).text = String((p as any).text).replace(/\s*\[\[followups:[^\]]*\]\]\s*/g, '').trimEnd();
        }
        state.parts = (state.parts ?? []).filter((p) => !(p.type === 'text' && !String((p as any).text).trim()));
        if (withFollowUps && followups.length) state.parts.push({ type: 'follow-ups', items: followups.slice(0, 3) });
        const run = await this.prisma.run.update({
            where: { id: runId },
            data: { status: 'COMPLETED', finished_at: new Date(), state: { ...state, messages: undefined } as unknown as Prisma.InputJsonValue },
        });
        await this.prisma.message.update({ where: { id: state.message_id! }, data: { status: 'COMPLETED', parts: state.parts as unknown as Prisma.InputJsonValue, content: this.textOf(state) } });
        await this.afterMessage(run, state);
        await this.computerTools.finishRun(run.id);
        await this.statusEvent(run, 'COMPLETED');
        if (run.type === 'TASK' && run.user_id) {
            const s = await this.prisma.userSettings.findUnique({ where: { user_id: run.user_id } });
            if (s?.notify_task_finished !== false) {
                const bot = await this.prisma.bot.findUnique({ where: { id: run.bot_id }, select: { name: true } });
                await this.notifications.notify({ user_id: run.user_id, organization_id: run.organization_id, event: 'TASK_FINISHED', title: `${bot?.name} finished: ${run.title ?? 'your task'}`, link_path: run.conversation_id ? `/c/${run.conversation_id}` : `/tasks/${run.id}` });
            }
        }
        await this.activity.log({ organization_id: run.organization_id, actor_bot_id: run.bot_id, on_behalf_of_id: run.user_id, action: 'run.completed', target_type: 'run', target_id: run.id, run_id: run.id, metadata: { type: run.type, cost: Number(run.cost) } });
    }

    private async afterMessage(run: { conversation_id: string | null }, state: RunState) {
        await this.messageEvents.publish(state.message_id!);
        if (!run.conversation_id) return;
        await this.prisma.conversation.update({ where: { id: run.conversation_id }, data: { last_message_at: new Date(), message_count: { increment: 1 } } });
        await this.prisma.conversationParticipant.updateMany({ where: { conversation_id: run.conversation_id, user_id: { not: null }, left_at: null }, data: { unread_count: { increment: 1 } } });
        const users = await this.prisma.conversationParticipant.findMany({ where: { conversation_id: run.conversation_id, user_id: { not: null }, left_at: null }, select: { user_id: true } });
        await this.events.toUsers(users.map((u) => u.user_id!), UserEvents.CONVERSATIONS_CHANGED, { conversation_id: run.conversation_id });
    }

    async fail(runId: string, state: RunState, message: string) {
        const run = await this.prisma.run.update({ where: { id: runId }, data: { status: 'FAILED', finished_at: new Date(), error: message.slice(0, 1000), state: { ...state, messages: undefined } as unknown as Prisma.InputJsonValue } });
        if (state.message_id) {
            state.parts = [...(state.parts ?? []).filter((p) => !(p.type === 'text' && !String((p as any).text).trim())), { type: 'error', message }];
            await this.prisma.message.update({ where: { id: state.message_id }, data: { status: 'FAILED', parts: state.parts as unknown as Prisma.InputJsonValue, content: this.textOf(state) || null } });
            await this.messageEvents.publish(state.message_id);
        }
        await this.prisma.approval.updateMany({ where: { run_id: runId, status: 'PENDING' }, data: { status: 'CANCELLED', resolved_at: new Date() } });
        await this.computerTools.finishRun(runId);
        await this.statusEvent(run, 'FAILED', { error: message });
        if (run.type === 'TASK' && run.user_id) {
            await this.notifications.notify({ user_id: run.user_id, organization_id: run.organization_id, event: 'TASK_FAILED', title: `Task failed: ${run.title ?? 'task'}`, body: message, link_path: run.conversation_id ? `/c/${run.conversation_id}` : `/tasks/${run.id}` });
        }
    }

    async stop(runId: string, state: RunState) {
        const run = await this.prisma.run.update({ where: { id: runId }, data: { status: 'STOPPED', finished_at: new Date(), state: { ...state, messages: undefined } as unknown as Prisma.InputJsonValue } });
        await this.redis.client.del(this.redis.key(RedisKeys.runCancel(runId)));
        if (state.message_id) {
            state.parts = (state.parts ?? []).map((p) => (p.type === 'tool' && (p as any).status === 'running' ? { ...p, status: 'stopped' } : p));
            state.parts.push({ type: 'notice', text: 'Stopped.' });
            await this.prisma.message.update({ where: { id: state.message_id }, data: { status: 'STOPPED', parts: state.parts as unknown as Prisma.InputJsonValue, content: this.textOf(state) || null } });
            await this.messageEvents.publish(state.message_id);
        }
        await this.prisma.approval.updateMany({ where: { run_id: runId, status: 'PENDING' }, data: { status: 'CANCELLED', resolved_at: new Date() } });
        await this.computerTools.finishRun(runId);
        await this.statusEvent(run, 'STOPPED');
    }

    /** Marks a run failed when its job errored unexpectedly outside the loop. */
    async markCrashed(runId: string, error: string) {
        const run = await this.prisma.run.findUnique({ where: { id: runId } });
        if (!run || FINAL.includes(run.status)) return;
        await this.fail(runId, (run.state ?? {}) as RunState, error);
    }
}
