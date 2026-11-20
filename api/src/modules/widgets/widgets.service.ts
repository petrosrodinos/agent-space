import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ChatMessage, OpenRouterService } from '@/integrations/openrouter/openrouter.service';
import { redactValues } from '@/shared/utils/security/secret-detection.utils';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { decideApproval } from '../agent/approval-policy';
import { PromptBuilder } from '../agent/prompt.builder';
import { MessagePart, ToolContext } from '../agent/tools/tool.types';
import type { Actor } from '../bots/bots.service';
import { ModelsService } from '../catalog/models.service';
import { UsageService } from '../usage/usage.service';
import { CreateWidgetDto, UpdateWidgetDto } from './dto/widget.dto';
import { WidgetSpec, WidgetView } from './interfaces/widget.interface';

const MAX_REFRESH_STEPS = 8;
const TOOL_TIMEOUT_MS = 60_000;
const MAX_TOOL_OUTPUT = 12_000;
const MAX_WIDGETS_PER_USER = 100;

const REFRESH_RULES = (title: string, previous: string) =>
    `You are refreshing the saved widget "${title}" (§7.4) for the user. Nobody is chatting with you right now.\n` +
    `- Get fresh, current data with your tools (read only). Never send, create, change or delete anything.\n` +
    `- Then call show_ui exactly once with the same title and the same layout as before, with up-to-date values.\n` +
    `- If you can't get fresh data, call show_ui with the previous content and a short note block saying why.\n` +
    `- Don't write any other text.\n\nThe widget as it was last time (JSON blocks):\n${previous}`;

@Injectable()
export class WidgetsService {
    private readonly logger = new Logger(WidgetsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly openrouter: OpenRouterService,
        private readonly runner: AgentRunnerService,
        private readonly prompt: PromptBuilder,
        private readonly models: ModelsService,
        private readonly usage: UsageService,
    ) { }

    // ------------------------------------------------------------------ queries

    async list(actor: Actor): Promise<WidgetView[]> {
        const rows = await this.prisma.savedWidget.findMany({ where: { organization_id: actor.organization_id, user_id: actor.user_id }, orderBy: { updated_at: 'desc' } });
        return this.views(rows);
    }

    async get(actor: Actor, id: string): Promise<WidgetView> {
        const [view] = await this.views([await this.require(actor, id)]);
        return view;
    }

    // ------------------------------------------------------------------ changes

    async create(actor: Actor, dto: CreateWidgetDto): Promise<WidgetView> {
        const message = await this.prisma.message.findFirst({
            where: { id: dto.message_id, organization_id: actor.organization_id, deleted_at: null, conversation: { participants: { some: { user_id: actor.user_id, left_at: null } } } },
        });
        if (!message) throw new NotFoundException('Message not found');
        const part = ((message.parts ?? []) as MessagePart[]).find((p) => p.type === 'ui' && p.id === dto.ui_id) as (MessagePart & { title?: string; blocks?: unknown[]; fallback_text?: string }) | undefined;
        if (!part) throw new NotFoundException('That interactive reply was not found in the message');
        const count = await this.prisma.savedWidget.count({ where: { organization_id: actor.organization_id, user_id: actor.user_id } });
        if (count >= MAX_WIDGETS_PER_USER) throw new BadRequestException(`You can save up to ${MAX_WIDGETS_PER_USER} widgets. Delete one first.`);

        // The question that produced it is what the bot is asked again on every refresh.
        const question = await this.prisma.message.findFirst({
            where: { conversation_id: message.conversation_id, author_type: 'USER', deleted_at: null, created_at: { lte: message.created_at } },
            orderBy: { created_at: 'desc' },
            select: { content: true },
        });
        const title = dto.title?.trim() || part.title?.trim() || 'Widget';
        const spec: WidgetSpec = { bot_id: message.author_bot_id, blocks: part.blocks ?? [], fallback_text: part.fallback_text ?? '', refreshed_at: message.created_at.toISOString(), refresh_error: null };
        const row = await this.prisma.savedWidget.create({
            data: {
                organization_id: actor.organization_id,
                user_id: actor.user_id,
                conversation_id: message.conversation_id,
                source_message_id: message.id,
                title,
                spec: spec as unknown as Prisma.InputJsonValue,
                refresh_prompt: question?.content?.trim().slice(0, 2000) || `Show "${title}" with current data.`,
            },
        });
        return this.get(actor, row.id);
    }

    async update(actor: Actor, id: string, dto: UpdateWidgetDto): Promise<WidgetView> {
        await this.require(actor, id);
        await this.prisma.savedWidget.update({ where: { id }, data: { ...(dto.title ? { title: dto.title.trim() } : {}), ...(dto.refresh_prompt ? { refresh_prompt: dto.refresh_prompt.trim() } : {}) } });
        return this.get(actor, id);
    }

    async remove(actor: Actor, id: string) {
        await this.require(actor, id);
        await this.prisma.savedWidget.delete({ where: { id } });
        return { ok: true };
    }

    /**
     * Fresh data each time it's opened (§7.4): the widget's bot answers the saved question again with read-only
     * tools and must call show_ui; the new blocks replace the old ones. Runs as a TASK for usage and history.
     */
    async refresh(actor: Actor, id: string): Promise<WidgetView> {
        const widget = await this.require(actor, id);
        const spec = widget.spec as unknown as WidgetSpec;
        if (!spec.bot_id) throw new BadRequestException('This widget has no bot to refresh it');
        const [bot, user, userSettings, orgSettings, org, membership] = await Promise.all([
            this.prisma.bot.findFirst({ where: { id: spec.bot_id, organization_id: actor.organization_id, deleted_at: null }, include: { approval_rules: true } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: actor.user_id } }),
            this.prisma.userSettings.findUnique({ where: { user_id: actor.user_id } }),
            this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } }),
            this.prisma.organization.findUniqueOrThrow({ where: { id: actor.organization_id } }),
            this.prisma.organizationMember.findUniqueOrThrow({ where: { organization_id_user_id: { organization_id: actor.organization_id, user_id: actor.user_id } } }),
        ]);
        if (!bot) throw new NotFoundException('The bot behind this widget was deleted');
        const limit = await this.usage.limitReached(actor.organization_id, actor.user_id, bot.id);
        if (limit) throw new ForbiddenException(limit);

        const run = await this.prisma.run.create({
            data: { organization_id: actor.organization_id, bot_id: bot.id, user_id: actor.user_id, type: 'TASK', status: 'RUNNING', started_at: new Date(), title: `Refresh widget "${widget.title}"`, state: {} },
        });
        let captured: { blocks: unknown[]; fallback_text: string } | null = null;
        const ctx: ToolContext = {
            run,
            bot,
            user,
            user_settings: userSettings,
            org_settings: orgSettings,
            organization_id: actor.organization_id,
            actor: { user_id: actor.user_id, organization_id: actor.organization_id, role: membership.role },
            conversation_id: null,
            is_temporary: true, // no artifacts, nothing kept beyond the widget itself
            supports_vision: false,
            secrets_used: [],
            addPart: async (part) => {
                if (part.type === 'ui') captured = { blocks: (part as any).blocks ?? [], fallback_text: String((part as any).fallback_text ?? '') };
            },
        };

        let cost = 0;
        try {
            const resolved = await this.models.resolve(actor.organization_id, bot.model_id);
            const { tools: all, summary } = await this.runner.buildTools(ctx);
            // Read-only: the computer and anything that only changes things is left out up front.
            const tools = new Map(all.filter((t) => t.name !== 'computer_run' && !t.confirm).map((t) => [t.name, t]));
            const pctx = { run, bot, user, user_settings: { ...(userSettings ?? {}), suggested_follow_ups: false } as NonNullable<typeof userSettings>, org_settings: orgSettings, org_name: org.name, conversation: null, connection_summary: summary, supports_vision: false, computer_available: false, website_logins: [] };
            const system = await this.prompt.system(pctx);
            const messages: ChatMessage[] = [
                { role: 'system', content: `${system}\n\n${REFRESH_RULES(widget.title, JSON.stringify(spec.blocks).slice(0, 6000))}` },
                { role: 'user', content: widget.refresh_prompt || `Show "${widget.title}" with current data.` },
            ];
            const schemas = [...tools.values()].map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

            for (let step = 0; step < MAX_REFRESH_STEPS && !captured; step++) {
                const res = await this.openrouter.complete({ model: resolved.model.openrouter_id, fallbackModels: resolved.fallbacks, messages, tools: schemas, temperature: 0.2, maxTokens: 6000 });
                cost += res.usage.cost || 0;
                await this.usage.record({ organization_id: actor.organization_id, user_id: actor.user_id, bot_id: bot.id, run_id: run.id, model_openrouter_id: res.model, input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens, cost: res.usage.cost || 0 });
                await this.prisma.run.update({ where: { id: run.id }, data: { input_tokens: { increment: res.usage.prompt_tokens }, output_tokens: { increment: res.usage.completion_tokens }, cost: { increment: new Prisma.Decimal(res.usage.cost || 0) } } });
                messages.push({ role: 'assistant', content: res.content || null, ...(res.tool_calls.length ? { tool_calls: res.tool_calls } : {}) });
                if (!res.tool_calls.length) break;
                for (const call of res.tool_calls) {
                    messages.push({ role: 'tool', tool_call_id: call.id, content: await this.callTool(ctx, tools, call.function.name, call.function.arguments) });
                }
            }
            if (!captured) throw new Error('The bot did not produce the widget. Try again, or change what it is asked.');
            const fresh = captured as { blocks: unknown[]; fallback_text: string };
            const next: WidgetSpec = { ...spec, blocks: fresh.blocks, fallback_text: fresh.fallback_text, refreshed_at: new Date().toISOString(), refresh_error: null };
            await this.prisma.savedWidget.update({ where: { id }, data: { spec: next as unknown as Prisma.InputJsonValue } });
            await this.prisma.run.update({ where: { id: run.id }, data: { status: 'COMPLETED', finished_at: new Date() } });
        } catch (e) {
            const msg = ((e as Error).message || 'Refresh failed').slice(0, 300);
            this.logger.warn(`Widget ${id} refresh failed: ${msg}`);
            await this.prisma.run.update({ where: { id: run.id }, data: { status: 'FAILED', finished_at: new Date(), error: msg } });
            await this.prisma.savedWidget.update({ where: { id }, data: { spec: { ...spec, refresh_error: msg } as unknown as Prisma.InputJsonValue } });
        }
        this.logger.log(`Widget ${id} refreshed (cost ${cost.toFixed(4)})`);
        return this.get(actor, id);
    }

    // ------------------------------------------------------------------ helpers

    /** Runs one tool call for a refresh. Anything that needs approval is refused: widgets only read data. */
    private async callTool(ctx: ToolContext, tools: Map<string, import('../agent/tools/tool.types').ToolDef>, name: string, rawArgs: string): Promise<string> {
        const def = tools.get(name);
        if (!def) return `Error: the tool ${name} is not available while refreshing a widget.`;
        let args: any = {};
        try {
            args = rawArgs ? JSON.parse(rawArgs) : {};
        } catch {
            return 'Error: the tool arguments were not valid JSON.';
        }
        const action = await def.classify?.(args, ctx);
        if (def.always_approve?.(args) || (action && decideApproval(action, ctx.bot, ctx.org_settings, { toolPermission: def.tool_permission }).required)) {
            return 'Skipped: this would change something, and widget refreshes only read data.';
        }
        try {
            const result = await Promise.race([def.execute(args, ctx), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The tool took too long')), TOOL_TIMEOUT_MS))]);
            if ('wait' in result) return 'Skipped: this needs the user, who is not in a conversation right now.';
            const out = JSON.stringify(redactValues(result.output, ctx.secrets_used) ?? null);
            return out.length > MAX_TOOL_OUTPUT ? `${out.slice(0, MAX_TOOL_OUTPUT)}… [truncated]` : out;
        } catch (e) {
            return `Error: ${redactValues((e as Error).message || 'Tool failed', ctx.secrets_used)}`;
        }
    }

    private async require(actor: Actor, id: string) {
        const row = await this.prisma.savedWidget.findFirst({ where: { id, organization_id: actor.organization_id, user_id: actor.user_id } });
        if (!row) throw new NotFoundException('Widget not found');
        return row;
    }

    private async views(rows: { id: string; title: string; refresh_prompt: string | null; conversation_id: string | null; source_message_id: string | null; spec: Prisma.JsonValue; created_at: Date; updated_at: Date }[]): Promise<WidgetView[]> {
        const botIds = [...new Set(rows.map((r) => (r.spec as unknown as WidgetSpec).bot_id).filter((b): b is string => !!b))];
        const bots = botIds.length ? await this.prisma.bot.findMany({ where: { id: { in: botIds } }, select: { id: true, name: true, emoji: true, color: true } }) : [];
        const byId = new Map(bots.map((b) => [b.id, b]));
        return rows.map((r) => {
            const s = r.spec as unknown as WidgetSpec;
            return {
                id: r.id,
                title: r.title,
                refresh_prompt: r.refresh_prompt,
                conversation_id: r.conversation_id,
                source_message_id: r.source_message_id,
                bot: s.bot_id ? (byId.get(s.bot_id) ?? null) : null,
                blocks: s.blocks ?? [],
                fallback_text: s.fallback_text ?? '',
                refreshed_at: s.refreshed_at,
                refresh_error: s.refresh_error ?? null,
                created_at: r.created_at,
                updated_at: r.updated_at,
            };
        });
    }
}
