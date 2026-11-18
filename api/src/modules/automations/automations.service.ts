import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActionType, AutomationRunStatus, Prisma, Run, RunStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { UserEvents, EventsService } from '@/core/realtime/events.service';
import { MailService } from '@/integrations/mail/mail.service';
import { MailTemplates } from '@/integrations/mail/mail.templates';
import { paginate, toJsonSafe } from '@/shared/utils/pagination/pagination.utils';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { ConversationsService } from '../conversations/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACTIVE_RUN_STATUSES, RunsService } from '../runs/runs.service';
import { UsageService } from '../usage/usage.service';
import { cronError, describeCron, frequencyError, nextRun } from './automation-schedule.utils';
import { AutomationListQuery, AutomationRunsQuery, CreateAutomationDto, PreApprovalDto, UpdateAutomationDto } from './dto/automation.dto';

export const MEMORY_MAX_BYTES = 1024 * 1024;
const RETRY_DELAY_MS = 10 * 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const ACTIVE_AUTOMATION_RUN: AutomationRunStatus[] = ['QUEUED', 'RUNNING', 'WAITING_APPROVAL'];
const schedulerId = (id: string) => `automation:${id}`;

/** Keys whose values name the destination of an action (channel, recipient, repository…), used to match pre-approvals. */
const TARGET_KEYS = ['channel', 'channel_id', 'channel_name', 'to', 'recipient', 'recipient_email', 'recipients', 'email', 'repo', 'repository', 'repo_name', 'owner', 'chat_id', 'conversation_id', 'list_id', 'board_id', 'project', 'project_key', 'page_id', 'database_id', 'folder_id', 'calendar_id', 'url'];

const AUTOMATION_INCLUDE = {
    bot: { select: { id: true, name: true, emoji: true, color: true, deleted_at: true } },
    skill: { select: { id: true, name: true, emoji: true, slug: true } },
    connections: { include: { connection: { select: { id: true, label: true, service_name: true, service_key: true, status: true, deleted_at: true } } } },
    pre_approvals: { include: { connection: { select: { id: true, label: true, service_name: true } } }, orderBy: { created_at: 'asc' } },
    result_destinations: { include: { connection: { select: { id: true, label: true, service_name: true } } } },
    results_conversation: { select: { id: true, name: true, type: true } },
} satisfies Prisma.AutomationInclude;

type AutomationWithRelations = Prisma.AutomationGetPayload<{ include: typeof AUTOMATION_INCLUDE }>;

const norm = (s: string) => s.trim().toLowerCase().replace(/^[#@]/, '');

function collectValues(value: unknown, out: string[], keys?: string[], key?: string) {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
        if (!keys || (key && keys.includes(key.toLowerCase()))) out.push(...String(value).split(/[,;\s]+/).filter(Boolean));
        return;
    }
    if (Array.isArray(value)) return value.forEach((v) => collectValues(v, out, keys, key));
    if (typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) collectValues(v, out, keys, keys && key && keys.includes(key.toLowerCase()) ? key : k);
}

/**
 * A pre-approval covers one kind of action to one specific place (§10.3). The target ("channel:#security",
 * "repo:acme/x", "email:anna@acme.com") must equal a destination value of the tool call.
 */
export function targetMatches(target: string, args: Record<string, unknown>): boolean {
    const raw = target.includes(':') ? target.slice(target.indexOf(':') + 1) : target;
    const wanted = norm(raw);
    if (!wanted) return false;
    const values: string[] = [];
    collectValues(args, values, TARGET_KEYS);
    if (!values.length) collectValues(args, values);
    const set = new Set(values.map(norm));
    if (set.has(wanted)) return true;
    // "owner/repo" may arrive split across { owner, repo }.
    if (wanted.includes('/')) return wanted.split('/').every((seg) => set.has(seg));
    return false;
}

@Injectable()
export class AutomationsService {
    private readonly logger = new Logger(AutomationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly events: EventsService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly conversations: ConversationsService,
        private readonly runs: RunsService,
        private readonly usage: UsageService,
        private readonly notifications: NotificationsService,
        private readonly mail: MailService,
        @InjectQueue(Queues.AUTOMATIONS) private readonly queue: Queue,
    ) { }

    // =====================================================================
    // Reading
    // =====================================================================

    private shape(a: AutomationWithRelations, extra: Record<string, unknown> = {}) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { memory_notes, ...rest } = a;
        return toJsonSafe({
            ...rest,
            connections: a.connections.map((c) => c.connection),
            schedule_description: a.cron_expression ? describeCron(a.cron_expression) : null,
            memory_size: memory_notes ? Buffer.byteLength(JSON.stringify(memory_notes)) : 0,
            ...extra,
        });
    }

    async list(actor: Actor, q: AutomationListQuery) {
        const rows = await this.prisma.automation.findMany({
            where: {
                organization_id: actor.organization_id,
                owner_id: actor.user_id,
                deleted_at: null,
                ...(q.status ? { status: q.status } : {}),
                ...(q.bot_id ? { bot_id: q.bot_id } : {}),
                ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
            },
            include: { ...AUTOMATION_INCLUDE, runs: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, status: true, created_at: true, finished_at: true } } },
            orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
        });
        return rows.map(({ runs, ...a }) => this.shape(a, { last_run: runs[0] ?? null }));
    }

    private async requireOwned(actor: Actor, id: string) {
        const a = await this.prisma.automation.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null }, include: AUTOMATION_INCLUDE });
        if (!a) throw new NotFoundException('Automation not found');
        if (a.owner_id !== actor.user_id) throw new ForbiddenException('Only the owner can manage this automation');
        return a;
    }

    async get(actor: Actor, id: string) {
        const a = await this.requireOwned(actor, id);
        const [active, upcoming] = await Promise.all([
            this.prisma.automationRun.count({ where: { automation_id: id, status: { in: ACTIVE_AUTOMATION_RUN } } }),
            Promise.resolve(a.status === 'ACTIVE' && a.cron_expression ? nextRun(a.cron_expression, a.timezone ?? 'UTC') : null),
        ]);
        return this.shape(a, { is_running: active > 0, next_run_at: upcoming ?? a.next_run_at });
    }

    async listRuns(actor: Actor, id: string, q: AutomationRunsQuery) {
        await this.requireOwned(actor, id);
        // Runs stopped while not on a worker never reported back: bring their records up to date.
        const stale = await this.prisma.automationRun.findMany({ where: { automation_id: id, status: { in: ACTIVE_AUTOMATION_RUN }, run: { status: { notIn: ACTIVE_RUN_STATUSES } } }, include: { run: { select: { id: true, status: true, error: true } } } });
        for (const r of stale) if (r.run) await this.recordRunOutcome(r.run.id, r.run.status, r.run.error);
        const where = { automation_id: id };
        const [rows, total] = await Promise.all([
            this.prisma.automationRun.findMany({
                where,
                include: { run: { select: { id: true, status: true, conversation_id: true, cost: true, error: true, _count: { select: { steps: true } } } } },
                orderBy: { created_at: 'desc' },
                skip: (q.page - 1) * q.limit,
                take: q.limit,
            }),
            this.prisma.automationRun.count({ where }),
        ]);
        return toJsonSafe(paginate(rows, total, q.page, q.limit));
    }

    async getRun(actor: Actor, id: string, runId: string) {
        await this.requireOwned(actor, id);
        const r = await this.prisma.automationRun.findFirst({
            where: { id: runId, automation_id: id },
            include: { run: { include: { steps: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, type: true, status: true, title: true, tool_name: true, error: true, duration_ms: true, started_at: true } }, messages: { select: { id: true, content: true }, take: 1 } } } },
        });
        if (!r) throw new NotFoundException('Run not found');
        return toJsonSafe(r);
    }

    // =====================================================================
    // Validation helpers
    // =====================================================================

    private async orgSettings(orgId: string) {
        return this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
    }

    private async defaultTimezone(actor: Actor) {
        const [u, s] = await Promise.all([this.prisma.user.findUnique({ where: { id: actor.user_id }, select: { timezone: true } }), this.orgSettings(actor.organization_id)]);
        return u?.timezone || s?.default_timezone || 'UTC';
    }

    private async validateSchedule(orgId: string, cron: string, tz: string) {
        const err = cronError(cron, tz);
        if (err) throw new BadRequestException(err);
        const s = await this.orgSettings(orgId);
        const freq = frequencyError(cron, tz, s?.max_schedule_frequency ?? 'EVERY_HOUR');
        if (freq) throw new BadRequestException(freq);
    }

    private async validateConnections(actor: Actor, botId: string, ids: string[]) {
        if (!ids.length) return [];
        const usable = await this.prisma.connection.findMany({ where: { id: { in: ids }, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id, botId) }, select: { id: true } });
        if (usable.length !== new Set(ids).size) throw new BadRequestException('One or more connections are not available to you or this bot');
        return [...new Set(ids)];
    }

    private async validatePreApprovals(actor: Actor, list: PreApprovalDto[], connectionIds: string[]) {
        if (!list.length) return [];
        const s = await this.orgSettings(actor.organization_id);
        if (s && !s.automation_pre_approvals) throw new BadRequestException('Your organisation does not allow pre-approved actions in automations; runs will ask for approval instead.');
        const enforced = s?.enforced_approvals ?? [];
        for (const p of list) {
            if (enforced.includes(p.action_type) || p.action_type === 'CONSULT_SENSITIVE_BOT') {
                throw new BadRequestException(`"${p.action_type}" always needs approval in your organisation and can't be pre-approved. Every run will wait for approval at that step.`);
            }
            const target = p.target.trim();
            if (!target || target === '*' || /^\w+:\s*\*?$/.test(target)) throw new BadRequestException('Each pre-approval must name one specific place, e.g. "channel:#security".');
            if (p.connection_id && !connectionIds.includes(p.connection_id)) throw new BadRequestException('A pre-approval uses a connection that is not part of this automation');
        }
        const seen = new Set<string>();
        return list.filter((p) => {
            const k = `${p.action_type}|${p.connection_id ?? ''}|${p.target.trim().toLowerCase()}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    private async resultsConversation(actor: Actor, botId: string, conversationId?: string | null) {
        if (conversationId) {
            await this.access.requireParticipant(conversationId, actor.user_id);
            const c = await this.prisma.conversation.findFirst({ where: { id: conversationId, organization_id: actor.organization_id, deleted_at: null, is_temporary: false, participants: { some: { bot_id: botId, left_at: null } } } });
            if (!c) throw new BadRequestException('Results can only go to a conversation that includes this bot');
            return c.id;
        }
        const direct = await this.conversations.getOrCreateDirect(actor, { bot_id: botId });
        return direct.id;
    }

    private destinationsData(actor: Actor, dto: Pick<CreateAutomationDto, 'email_results' | 'results_email' | 'results_connection_id' | 'results_target'>, conversationId: string, connectionIds: string[]) {
        const out: Prisma.AutomationResultDestinationCreateWithoutAutomationInput[] = [{ kind: 'CONVERSATION', conversation_id: conversationId }];
        if (dto.email_results || dto.results_email) out.push({ kind: 'EMAIL', email: dto.results_email ?? null });
        if (dto.results_connection_id) {
            if (!connectionIds.includes(dto.results_connection_id)) throw new BadRequestException('The results connection must be one of the automation\'s connections');
            if (!dto.results_target?.trim()) throw new BadRequestException('Say where in that service the results go, e.g. "channel:#security"');
            out.push({ kind: 'CONNECTION', connection: { connect: { id: dto.results_connection_id } }, target: dto.results_target.trim() });
        }
        return out;
    }

    // =====================================================================
    // Writing
    // =====================================================================

    async create(actor: Actor, dto: CreateAutomationDto) {
        const s = await this.orgSettings(actor.organization_id);
        if (s && !s.automations_enabled) throw new ForbiddenException('Automations are turned off for your organisation');
        if (s?.max_automations_per_member) {
            const n = await this.prisma.automation.count({ where: { organization_id: actor.organization_id, owner_id: actor.user_id, deleted_at: null } });
            if (n >= s.max_automations_per_member) throw new ForbiddenException(`You can have at most ${s.max_automations_per_member} automations in this organisation`);
        }
        if (dto.uses_cloud_computer && s && !s.automations_cloud_computer) throw new ForbiddenException('Your organisation does not allow automations to use the cloud computer');
        await this.access.requireUsableBot(actor.organization_id, actor.user_id, dto.bot_id);
        const tz = dto.timezone || (await this.defaultTimezone(actor));
        await this.validateSchedule(actor.organization_id, dto.cron_expression, tz);
        if (dto.skill_id && !(await this.prisma.skill.count({ where: { id: dto.skill_id, ...this.access.usableSkillsWhere(actor.organization_id, actor.user_id) } }))) throw new BadRequestException('Skill not found');
        const connectionIds = await this.validateConnections(actor, dto.bot_id, [...(dto.connection_ids ?? []), ...(dto.results_connection_id ? [dto.results_connection_id] : [])]);
        const preApprovals = await this.validatePreApprovals(actor, dto.pre_approvals ?? [], connectionIds);
        const resultsConversationId = await this.resultsConversation(actor, dto.bot_id, dto.results_conversation_id);

        const a = await this.prisma.automation.create({
            data: {
                organization_id: actor.organization_id,
                owner_id: actor.user_id,
                bot_id: dto.bot_id,
                name: dto.name.trim(),
                instructions: dto.instructions.trim(),
                skill_id: dto.skill_id ?? null,
                trigger_kind: 'SCHEDULE',
                cron_expression: dto.cron_expression.trim(),
                timezone: tz,
                uses_cloud_computer: !!dto.uses_cloud_computer,
                memory_plan: dto.memory_plan ?? null,
                source_conversation_id: dto.source_conversation_id ?? null,
                results_conversation_id: resultsConversationId,
                next_run_at: nextRun(dto.cron_expression, tz),
                pre_approvals_confirmed_at: new Date(),
                connections: { create: connectionIds.map((connection_id) => ({ connection_id })) },
                pre_approvals: { create: preApprovals.map((p) => ({ action_type: p.action_type, connection_id: p.connection_id ?? null, target: p.target.trim() })) },
                result_destinations: { create: this.destinationsData(actor, dto, resultsConversationId, connectionIds) },
            },
            include: AUTOMATION_INCLUDE,
        });
        await this.syncScheduler(a.id);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.created', target_type: 'automation', target_id: a.id, metadata: { name: a.name, schedule: a.cron_expression, pre_approvals: preApprovals.length } });
        await this.changed(actor.user_id, a.id);
        return this.shape(a);
    }

    async update(actor: Actor, id: string, dto: UpdateAutomationDto) {
        const a = await this.requireOwned(actor, id);
        const botId = dto.bot_id ?? a.bot_id;
        if (dto.bot_id && dto.bot_id !== a.bot_id) await this.access.requireUsableBot(actor.organization_id, actor.user_id, dto.bot_id);
        const cron = dto.cron_expression ?? a.cron_expression ?? '';
        const tz = dto.timezone ?? a.timezone ?? 'UTC';
        if (dto.cron_expression !== undefined || dto.timezone !== undefined) await this.validateSchedule(actor.organization_id, cron, tz);
        if (dto.uses_cloud_computer) {
            const s = await this.orgSettings(actor.organization_id);
            if (s && !s.automations_cloud_computer) throw new ForbiddenException('Your organisation does not allow automations to use the cloud computer');
        }
        if (dto.skill_id && !(await this.prisma.skill.count({ where: { id: dto.skill_id, ...this.access.usableSkillsWhere(actor.organization_id, actor.user_id) } }))) throw new BadRequestException('Skill not found');

        const currentConnIds = a.connections.map((c) => c.connection_id);
        const connectionIds = dto.connection_ids !== undefined || dto.results_connection_id ? await this.validateConnections(actor, botId, [...(dto.connection_ids ?? currentConnIds), ...(dto.results_connection_id ? [dto.results_connection_id] : [])]) : currentConnIds;
        const preApprovals = dto.pre_approvals ? await this.validatePreApprovals(actor, dto.pre_approvals, connectionIds) : null;

        const destinationsTouched = ['email_results', 'results_email', 'results_connection_id', 'results_target', 'results_conversation_id'].some((k) => (dto as Record<string, unknown>)[k] !== undefined);
        // §10.3: changing instructions, connections or results destination asks the user to confirm pre-approvals again.
        const needsReconfirm =
            !preApprovals && a.pre_approvals.length > 0 && ((dto.instructions !== undefined && dto.instructions.trim() !== a.instructions) || dto.connection_ids !== undefined || destinationsTouched || (dto.bot_id !== undefined && dto.bot_id !== a.bot_id));

        let resultsConversationId = a.results_conversation_id;
        if (dto.results_conversation_id !== undefined || (dto.bot_id && dto.bot_id !== a.bot_id)) resultsConversationId = await this.resultsConversation(actor, botId, dto.results_conversation_id ?? null);

        await this.prisma.$transaction(async (tx) => {
            await tx.automation.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                    ...(dto.instructions !== undefined ? { instructions: dto.instructions.trim() } : {}),
                    ...(dto.cron_expression !== undefined ? { cron_expression: dto.cron_expression.trim() } : {}),
                    ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
                    ...(dto.bot_id !== undefined ? { bot_id: dto.bot_id } : {}),
                    ...(dto.skill_id !== undefined ? { skill_id: dto.skill_id } : {}),
                    ...(dto.memory_plan !== undefined ? { memory_plan: dto.memory_plan } : {}),
                    ...(dto.uses_cloud_computer !== undefined ? { uses_cloud_computer: dto.uses_cloud_computer } : {}),
                    results_conversation_id: resultsConversationId,
                    next_run_at: a.status === 'ACTIVE' && cron ? nextRun(cron, tz) : a.next_run_at,
                    ...(preApprovals ? { pre_approvals_confirmed_at: new Date() } : needsReconfirm ? { pre_approvals_confirmed_at: null } : {}),
                },
            });
            if (dto.connection_ids !== undefined || dto.results_connection_id) {
                await tx.automationConnection.deleteMany({ where: { automation_id: id } });
                await tx.automationConnection.createMany({ data: connectionIds.map((connection_id) => ({ automation_id: id, connection_id })) });
                // Pre-approvals for removed connections no longer apply.
                await tx.automationPreApproval.deleteMany({ where: { automation_id: id, connection_id: { notIn: connectionIds } } });
            }
            if (preApprovals) {
                await tx.automationPreApproval.deleteMany({ where: { automation_id: id } });
                await tx.automationPreApproval.createMany({ data: preApprovals.map((p) => ({ automation_id: id, action_type: p.action_type, connection_id: p.connection_id ?? null, target: p.target.trim() })) });
            }
            if (destinationsTouched || resultsConversationId !== a.results_conversation_id) {
                const old = a.result_destinations;
                const merged = {
                    email_results: dto.email_results ?? old.some((d) => d.kind === 'EMAIL'),
                    results_email: dto.results_email !== undefined ? dto.results_email : (old.find((d) => d.kind === 'EMAIL')?.email ?? null),
                    results_connection_id: dto.results_connection_id !== undefined ? dto.results_connection_id : (old.find((d) => d.kind === 'CONNECTION')?.connection_id ?? null),
                    results_target: dto.results_target !== undefined ? dto.results_target : (old.find((d) => d.kind === 'CONNECTION')?.target ?? null),
                };
                if (merged.email_results === false && dto.email_results === false) merged.results_email = null;
                await tx.automationResultDestination.deleteMany({ where: { automation_id: id } });
                for (const d of this.destinationsData(actor, merged, resultsConversationId!, connectionIds)) await tx.automationResultDestination.create({ data: { ...d, automation: { connect: { id } } } });
            }
        });
        await this.syncScheduler(id);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.updated', target_type: 'automation', target_id: id, metadata: { fields: Object.keys(dto), pre_approvals_need_confirmation: needsReconfirm } });
        await this.changed(actor.user_id, id);
        return this.get(actor, id);
    }

    async confirmPreApprovals(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        await this.prisma.automation.update({ where: { id }, data: { pre_approvals_confirmed_at: new Date() } });
        await this.changed(actor.user_id, id);
        return this.get(actor, id);
    }

    async removePreApproval(actor: Actor, id: string, preApprovalId: string) {
        await this.requireOwned(actor, id);
        const res = await this.prisma.automationPreApproval.deleteMany({ where: { id: preApprovalId, automation_id: id } });
        if (!res.count) throw new NotFoundException('Pre-approval not found');
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.pre_approval_removed', target_type: 'automation', target_id: id });
        await this.changed(actor.user_id, id);
        return { ok: true };
    }

    async pause(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        await this.prisma.automation.update({ where: { id }, data: { status: 'PAUSED', status_reason: null, next_run_at: null } });
        await this.syncScheduler(id);
        await this.changed(actor.user_id, id);
        return this.get(actor, id);
    }

    /** Resumes after the user fixed what was wrong (§10.5): every connection it uses must be working again. */
    async resume(actor: Actor, id: string) {
        const a = await this.requireOwned(actor, id);
        const s = await this.orgSettings(actor.organization_id);
        if (s && !s.automations_enabled) throw new ForbiddenException('Automations are turned off for your organisation');
        await this.access.requireUsableBot(actor.organization_id, actor.user_id, a.bot_id).catch(() => {
            throw new BadRequestException('The bot this automation uses is no longer available to you. Pick another bot first.');
        });
        const broken = a.connections.filter((c) => c.connection.deleted_at || c.connection.status !== 'ACTIVE');
        if (broken.length) throw new BadRequestException(`Reconnect ${broken.map((c) => `"${c.connection.label}"`).join(', ')} on the Connections page first.`);
        const limit = await this.usage.limitReached(actor.organization_id, actor.user_id, a.bot_id);
        if (limit) throw new BadRequestException(limit);
        await this.prisma.automation.update({ where: { id }, data: { status: 'ACTIVE', status_reason: null, consecutive_failures: 0, next_run_at: a.cron_expression ? nextRun(a.cron_expression, a.timezone ?? 'UTC') : null } });
        await this.syncScheduler(id);
        await this.changed(actor.user_id, id);
        return this.get(actor, id);
    }

    async runNow(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        const result = await this.tick(id, { manual: true });
        if (result.status === 'skipped') throw new BadRequestException(result.reason);
        return result;
    }

    async duplicate(actor: Actor, id: string) {
        const a = await this.requireOwned(actor, id);
        const copy = await this.prisma.automation.create({
            data: {
                organization_id: a.organization_id,
                owner_id: actor.user_id,
                bot_id: a.bot_id,
                name: `${a.name} (copy)`.slice(0, 120),
                instructions: a.instructions,
                skill_id: a.skill_id,
                trigger_kind: a.trigger_kind,
                cron_expression: a.cron_expression,
                timezone: a.timezone,
                uses_cloud_computer: a.uses_cloud_computer,
                memory_plan: a.memory_plan,
                source_conversation_id: a.source_conversation_id,
                results_conversation_id: a.results_conversation_id,
                // Copies start paused so two identical jobs never run by surprise.
                status: 'PAUSED',
                pre_approvals_confirmed_at: a.pre_approvals_confirmed_at,
                connections: { create: a.connections.map((c) => ({ connection_id: c.connection_id })) },
                pre_approvals: { create: a.pre_approvals.map((p) => ({ action_type: p.action_type, connection_id: p.connection_id, target: p.target })) },
                result_destinations: { create: a.result_destinations.map((d) => ({ kind: d.kind, conversation_id: d.conversation_id, email: d.email, connection_id: d.connection_id, target: d.target })) },
            },
            include: AUTOMATION_INCLUDE,
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.duplicated', target_type: 'automation', target_id: copy.id, metadata: { from: id } });
        await this.changed(actor.user_id, copy.id);
        return this.shape(copy);
    }

    async remove(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        await this.prisma.automation.update({ where: { id }, data: { deleted_at: new Date(), status: 'PAUSED', next_run_at: null } });
        await this.syncScheduler(id);
        // Automation memory files are deleted with it (§10.4).
        await this.prisma.file.updateMany({ where: { automation_id: id, deleted_at: null }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + 30 * 86400_000) } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.deleted', target_type: 'automation', target_id: id });
        await this.changed(actor.user_id, id);
        return { ok: true };
    }

    // ---- Memory (§10.4) ----

    async getMemory(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        const a = await this.prisma.automation.findUniqueOrThrow({ where: { id }, select: { memory_notes: true, memory_plan: true, updated_at: true } });
        const files = await this.prisma.file.findMany({ where: { automation_id: id, deleted_at: null, status: 'READY' }, select: { id: true, filename: true, mimetype: true, size: true, created_at: true } });
        return toJsonSafe({ notes: a.memory_notes ?? {}, plan: a.memory_plan, files, size: a.memory_notes ? Buffer.byteLength(JSON.stringify(a.memory_notes)) : 0, max_size: MEMORY_MAX_BYTES });
    }

    async setMemory(actor: Actor, id: string, notes: Record<string, unknown>) {
        await this.requireOwned(actor, id);
        await this.writeMemory(id, notes);
        await this.changed(actor.user_id, id);
        return this.getMemory(actor, id);
    }

    async resetMemory(actor: Actor, id: string) {
        await this.requireOwned(actor, id);
        await this.prisma.automation.update({ where: { id }, data: { memory_notes: Prisma.DbNull } });
        await this.prisma.file.updateMany({ where: { automation_id: id, deleted_at: null }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + 30 * 86400_000) } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'automation.memory_reset', target_type: 'automation', target_id: id });
        await this.changed(actor.user_id, id);
        return this.getMemory(actor, id);
    }

    async readMemory(id: string) {
        const a = await this.prisma.automation.findUnique({ where: { id }, select: { memory_notes: true } });
        return (a?.memory_notes ?? {}) as Record<string, unknown>;
    }

    async writeMemory(id: string, notes: Record<string, unknown>) {
        const size = Buffer.byteLength(JSON.stringify(notes ?? {}));
        if (size > MEMORY_MAX_BYTES) throw new BadRequestException(`Automation memory is limited to 1 MB (this would be ${Math.round(size / 1024)} KB). Keep only what the next run needs.`);
        await this.prisma.automation.update({ where: { id }, data: { memory_notes: notes as Prisma.InputJsonValue } });
    }

    private async changed(userId: string, id: string) {
        await this.events.toUser(userId, UserEvents.AUTOMATIONS_CHANGED, { automation_id: id }).catch(() => undefined);
    }

    // =====================================================================
    // Scheduling (§10.6 "Scheduling", §14.4)
    // =====================================================================

    /** Upserts the automation's job scheduler when it should run, removes it otherwise. */
    async syncScheduler(id: string) {
        const a = await this.prisma.automation.findUnique({ where: { id } });
        const shouldRun = a && !a.deleted_at && a.status === 'ACTIVE' && a.trigger_kind === 'SCHEDULE' && a.cron_expression;
        if (shouldRun) {
            const tz = a.timezone ?? 'UTC';
            await this.queue.upsertJobScheduler(schedulerId(id), { pattern: a.cron_expression!, tz }, { name: Jobs.automations.TICK, data: { automation_id: id } });
            await this.prisma.automation.update({ where: { id }, data: { next_run_at: nextRun(a.cron_expression!, tz) } });
        } else {
            await this.queue.removeJobScheduler(schedulerId(id)).catch(() => undefined);
        }
    }

    /** Nightly `reconcile-schedulers`: active automations have exactly one scheduler; nothing else does. */
    async reconcile() {
        const active = await this.prisma.automation.findMany({ where: { deleted_at: null, status: 'ACTIVE', trigger_kind: 'SCHEDULE', cron_expression: { not: null } }, select: { id: true } });
        const ids = new Set(active.map((a) => a.id));
        for (const a of active) await this.syncScheduler(a.id).catch((e) => this.logger.warn(`Scheduler ${a.id}: ${(e as Error).message}`));
        let removed = 0;
        const schedulers = await this.queue.getJobSchedulers(0, -1);
        for (const s of schedulers) {
            const key = s.key ?? s.id ?? '';
            if (key.startsWith('automation:') && !ids.has(key.slice('automation:'.length))) {
                await this.queue.removeJobScheduler(key).catch(() => undefined);
                removed++;
            }
        }
        return { active: ids.size, removed };
    }

    private async pauseForAttention(id: string, ownerId: string, orgId: string, name: string, reason: string, status: 'NEEDS_ATTENTION' | 'PAUSED' = 'NEEDS_ATTENTION') {
        await this.prisma.automation.update({ where: { id }, data: { status, status_reason: reason.slice(0, 500), next_run_at: null } });
        await this.queue.removeJobScheduler(schedulerId(id)).catch(() => undefined);
        await this.notifications.notify({ user_id: ownerId, organization_id: orgId, event: 'AUTOMATION_PAUSED', title: `Automation paused: ${name}`, body: reason, link_path: `/automations/${id}`, is_urgent: true });
        await this.changed(ownerId, id);
    }

    private async skip(automationId: string, reason: string, scheduledFor: Date | null) {
        await this.prisma.automationRun.create({ data: { automation_id: automationId, status: 'SKIPPED', scheduled_for: scheduledFor, finished_at: new Date(), result_summary: reason } });
        return { status: 'skipped' as const, reason };
    }

    /**
     * `tick` (and `retry`): checks status, access and usage limits, refuses a run while another is active (recorded as
     * skipped), then queues the run on `agent-runs` (§10.6).
     */
    async tick(automationId: string, opts: { manual?: boolean; retry_of?: string; scheduled_for?: Date | null } = {}): Promise<{ status: 'started'; automation_run_id: string; run_id: string } | { status: 'skipped' | 'ignored'; reason: string }> {
        const lock = await this.redis.acquireLock(RedisKeys.automationLock(automationId), 30_000);
        if (!lock) return { status: 'ignored', reason: 'Another start of this automation is in progress' };
        try {
            const a = await this.prisma.automation.findUnique({ where: { id: automationId }, include: { connections: { include: { connection: true } } } });
            if (!a || a.deleted_at) {
                await this.queue.removeJobScheduler(schedulerId(automationId)).catch(() => undefined);
                return { status: 'ignored', reason: 'Automation deleted' };
            }
            if (a.status !== 'ACTIVE' && !opts.manual) {
                await this.queue.removeJobScheduler(schedulerId(automationId)).catch(() => undefined);
                return { status: 'ignored', reason: 'Automation is not active' };
            }
            const scheduledFor = opts.scheduled_for ?? new Date();
            const nextAt = a.status === 'ACTIVE' && a.cron_expression ? nextRun(a.cron_expression, a.timezone ?? 'UTC') : a.next_run_at;
            if (!opts.manual) await this.prisma.automation.update({ where: { id: a.id }, data: { next_run_at: nextAt } });

            const s = await this.orgSettings(a.organization_id);
            if (s && !s.automations_enabled) return this.skip(a.id, 'Automations are turned off for this organisation.', scheduledFor);

            const member = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: a.organization_id, user_id: a.owner_id } } });
            if (!member) {
                await this.pauseForAttention(a.id, a.owner_id, a.organization_id, a.name, 'You are no longer a member of this organisation.', 'PAUSED');
                return { status: 'skipped', reason: 'Owner left the organisation' };
            }
            const actor: Actor = { user_id: a.owner_id, organization_id: a.organization_id, role: member.role };
            const bot = await this.access.requireUsableBot(a.organization_id, a.owner_id, a.bot_id).catch(() => null);
            if (!bot) {
                await this.pauseForAttention(a.id, a.owner_id, a.organization_id, a.name, 'The bot this automation uses was deleted or is no longer available to you. Pick another bot and resume.');
                return { status: 'skipped', reason: 'Bot unavailable' };
            }
            const usable = await this.prisma.connection.findMany({ where: { id: { in: a.connections.map((c) => c.connection_id) }, ...this.access.usableConnectionsWhere(a.organization_id, a.owner_id, a.bot_id) }, select: { id: true } });
            const broken = a.connections.filter((c) => c.connection.deleted_at || c.connection.status !== 'ACTIVE' || !usable.some((u) => u.id === c.connection_id));
            if (broken.length) {
                const reason = `${broken.map((c) => `"${c.connection.label}"`).join(', ')} ${broken.length === 1 ? 'needs' : 'need'} re-connecting or ${broken.length === 1 ? 'is' : 'are'} no longer available to you. Fix it on the Connections page, then click Resume.`;
                await this.pauseForAttention(a.id, a.owner_id, a.organization_id, a.name, reason);
                return this.skip(a.id, reason, scheduledFor);
            }
            const limit = await this.usage.limitReached(a.organization_id, a.owner_id, a.bot_id);
            if (limit) {
                await this.pauseForAttention(a.id, a.owner_id, a.organization_id, a.name, limit);
                return this.skip(a.id, limit, scheduledFor);
            }

            // Never double up (§10.5): reconcile stale records first, then skip if a run is still going.
            const actives = await this.prisma.automationRun.findMany({ where: { automation_id: a.id, status: { in: ACTIVE_AUTOMATION_RUN } }, include: { run: { select: { status: true, error: true, id: true } } } });
            let stillActive = false;
            for (const r of actives) {
                if (r.run && !ACTIVE_RUN_STATUSES.includes(r.run.status)) await this.recordRunOutcome(r.run.id, r.run.status, r.run.error);
                else if (!r.run && Date.now() - r.created_at.getTime() > 10 * 60_000) await this.prisma.automationRun.update({ where: { id: r.id }, data: { status: 'FAILED', error: 'The run never started', finished_at: new Date() } });
                else stillActive = true;
            }
            if (stillActive) return this.skip(a.id, 'Skipped: the previous run was still going.', scheduledFor);

            let conversationId = a.results_conversation_id;
            const ok = conversationId ? await this.prisma.conversation.count({ where: { id: conversationId, deleted_at: null, participants: { some: { user_id: a.owner_id, left_at: null } } } }) : 0;
            if (!ok) {
                conversationId = await this.resultsConversation(actor, a.bot_id, null);
                await this.prisma.automation.update({ where: { id: a.id }, data: { results_conversation_id: conversationId } });
                await this.prisma.automationResultDestination.updateMany({ where: { automation_id: a.id, kind: 'CONVERSATION' }, data: { conversation_id: conversationId } });
            }

            const retryOf = opts.retry_of ? await this.prisma.automationRun.findUnique({ where: { id: opts.retry_of } }) : null;
            const ar = await this.prisma.automationRun.create({ data: { automation_id: a.id, status: 'QUEUED', scheduled_for: scheduledFor, is_retry: !!retryOf, attempt: retryOf ? retryOf.attempt + 1 : 1 } });
            await this.conversations.systemMessage(conversationId!, a.organization_id, `${opts.manual ? 'Running now' : retryOf ? 'Retrying' : 'Scheduled run'}: ${a.name}`);
            const run = await this.runs.start({ organization_id: a.organization_id, conversation_id: conversationId, bot_id: a.bot_id, user_id: a.owner_id, type: 'AUTOMATION_RUN', skill_id: a.skill_id, title: a.name, automation_run_id: ar.id });
            await this.prisma.automation.update({ where: { id: a.id }, data: { last_run_at: new Date(), run_count: { increment: 1 } } });
            await this.changed(a.owner_id, a.id);
            return { status: 'started', automation_run_id: ar.id, run_id: run.id };
        } finally {
            await lock.release();
        }
    }

    // =====================================================================
    // Run outcomes (called by the run loop) and pre-approvals (approval engine)
    // =====================================================================

    /** Keeps the automation run record and counters in step with its agent run; applies retry and auto-pause rules (§10.5). */
    async recordRunOutcome(runId: string, status: RunStatus, error?: string | null) {
        const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { id: true, automation_run_id: true, started_at: true, finished_at: true } });
        if (!run?.automation_run_id) return;
        const ar = await this.prisma.automationRun.findUnique({ where: { id: run.automation_run_id }, include: { automation: true } });
        if (!ar) return;
        const a = ar.automation;
        const map: Partial<Record<RunStatus, AutomationRunStatus>> = { RUNNING: 'RUNNING', WAITING_APPROVAL: 'WAITING_APPROVAL', WAITING_INPUT: 'WAITING_APPROVAL', COMPLETED: 'SUCCEEDED', FAILED: 'FAILED', STOPPED: 'STOPPED' };
        const next = map[status];
        if (!next || ar.status === next) return;
        const final = next === 'SUCCEEDED' || next === 'FAILED' || next === 'STOPPED';
        if (!final) {
            await this.prisma.automationRun.update({ where: { id: ar.id }, data: { status: next, started_at: ar.started_at ?? new Date() } });
            if (next === 'WAITING_APPROVAL') await this.notifyOwner(a, `${a.name} is waiting for your approval`, 'A step in this run needs approval because it was not pre-approved.');
            await this.changed(a.owner_id, a.id);
            return;
        }
        if (ACTIVE_AUTOMATION_RUN.includes(ar.status) === false) return;
        const message = await this.prisma.message.findFirst({ where: { run_id: runId, author_type: 'BOT' }, orderBy: { created_at: 'desc' }, select: { content: true } });
        const summary = (message?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 600) || null;
        const startedAt = ar.started_at ?? run.started_at ?? ar.created_at;
        await this.prisma.automationRun.update({ where: { id: ar.id }, data: { status: next, started_at: startedAt, finished_at: new Date(), duration_ms: Date.now() - startedAt.getTime(), result_summary: summary, error: next === 'FAILED' ? (error ?? 'The run failed').slice(0, 1000) : null } });

        if (next === 'SUCCEEDED') {
            await this.prisma.automation.update({ where: { id: a.id }, data: { consecutive_failures: 0 } });
            await this.deliverResults(a, summary, runId);
        } else if (next === 'FAILED') {
            if (!ar.is_retry && a.status === 'ACTIVE') {
                await this.queue.add(Jobs.automations.RETRY, { automation_id: a.id, retry_of: ar.id }, { delay: RETRY_DELAY_MS, jobId: `automation-retry:${ar.id}` });
                await this.prisma.automationRun.update({ where: { id: ar.id }, data: { result_summary: 'Failed. Retrying once in 10 minutes.' } });
            } else {
                const updated = await this.prisma.automation.update({ where: { id: a.id }, data: { consecutive_failures: { increment: 1 } } });
                if (updated.consecutive_failures >= MAX_CONSECUTIVE_FAILURES && updated.status === 'ACTIVE') {
                    await this.pauseForAttention(a.id, a.owner_id, a.organization_id, a.name, `It failed ${updated.consecutive_failures} times in a row. Last error: ${error ?? 'unknown'}. Check it, then click Resume.`);
                } else {
                    await this.notifications.notify({ user_id: a.owner_id, organization_id: a.organization_id, event: 'AUTOMATION_RESULT', title: `Automation failed: ${a.name}`, body: error ?? 'The run failed.', link_path: `/automations/${a.id}` });
                }
            }
        }
        await this.changed(a.owner_id, a.id);
    }

    private async notifyOwner(a: { id: string; owner_id: string; organization_id: string }, title: string, body: string) {
        await this.notifications.notify({ user_id: a.owner_id, organization_id: a.organization_id, event: 'AUTOMATION_RESULT', title, body, link_path: `/automations/${a.id}` });
    }

    /** Results always land in the results conversation; also by email when chosen (§10.2 "Where results go"). */
    private async deliverResults(a: { id: string; name: string; owner_id: string; organization_id: string; results_conversation_id: string | null }, summary: string | null, runId: string) {
        const [destinations, settings, owner] = await Promise.all([
            this.prisma.automationResultDestination.findMany({ where: { automation_id: a.id } }),
            this.prisma.userSettings.findUnique({ where: { user_id: a.owner_id } }),
            this.prisma.user.findUnique({ where: { id: a.owner_id }, select: { email: true } }),
        ]);
        const link = a.results_conversation_id ? `/c/${a.results_conversation_id}` : `/automations/${a.id}`;
        await this.notifications.notify({ user_id: a.owner_id, organization_id: a.organization_id, event: 'AUTOMATION_RESULT', title: `${a.name}: done`, body: summary, link_path: link, data: { automation_id: a.id, run_id: runId } });
        const email = destinations.find((d) => d.kind === 'EMAIL');
        const wantsEmail = !!email || settings?.automation_results_to === 'EMAIL' || settings?.automation_results_to === 'BOTH';
        const to = email?.email || owner?.email;
        if (wantsEmail && to) {
            const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
            const tpl = MailTemplates.notification({ title: `${a.name}: results`, body: summary ?? 'The automation finished.', url: appUrl ? `${appUrl}${link}` : null });
            await this.mail.send({ to, ...tpl }).catch((e) => this.logger.warn(`Automation result email failed: ${(e as Error).message}`));
        }
    }

    /** Approval engine hook: does this automation run have a confirmed pre-approval for the action, place and account (§10.3)? */
    async isPreApproved(run: Pick<Run, 'automation_run_id' | 'organization_id'>, action: ActionType | null, connectionId: string | undefined, args: Record<string, unknown>) {
        if (!action || !run.automation_run_id) return false;
        const ar = await this.prisma.automationRun.findUnique({ where: { id: run.automation_run_id }, include: { automation: { include: { pre_approvals: true } } } });
        const a = ar?.automation;
        if (!a || !a.pre_approvals_confirmed_at || !a.pre_approvals.length) return false;
        const s = await this.orgSettings(run.organization_id);
        if (s && !s.automation_pre_approvals) return false;
        return a.pre_approvals.some((p) => p.action_type === action && (!p.connection_id || p.connection_id === connectionId) && targetMatches(p.target, args ?? {}));
    }

    /** Extra system prompt and the run's opening instruction for automation runs. */
    async promptFor(run: Pick<Run, 'automation_run_id'>): Promise<{ system: string; user: string; automation_id: string } | null> {
        if (!run.automation_run_id) return null;
        const ar = await this.prisma.automationRun.findUnique({
            where: { id: run.automation_run_id },
            include: { automation: { include: { pre_approvals: { include: { connection: { select: { label: true } } } }, result_destinations: { include: { connection: { select: { label: true } } } }, connections: { include: { connection: { select: { label: true, service_name: true } } } }, skill: { select: { slug: true, name: true } } } } },
        });
        if (!ar) return null;
        const a = ar.automation;
        const tz = a.timezone ?? 'UTC';
        const now = new Date().toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
        const preApproved = a.pre_approvals_confirmed_at ? a.pre_approvals.map((p) => `- ${p.action_type} → ${p.target}${p.connection ? ` (${p.connection.label})` : ''}`) : [];
        const dest = a.result_destinations.map((d) => (d.kind === 'CONVERSATION' ? '- This conversation (your final reply is posted here automatically)' : d.kind === 'EMAIL' ? `- Email to ${d.email ?? 'the owner'} (sent automatically from your final reply)` : `- ${d.connection?.label ?? 'Connected service'} at ${d.target} — post it yourself with the right tool`));
        const system = [
            `## Automation run`,
            `You are running the automation "${a.name}" by yourself, on behalf of its owner. Nobody is watching right now: do the work end to end without asking questions. ${a.cron_expression ? `Schedule: ${describeCron(a.cron_expression)} (${tz}).` : ''} Current time: ${now}. Run #${a.run_count}${ar.is_retry ? ' (retry after a failure)' : ''}.`,
            a.connections.length ? `Accounts to use: ${a.connections.map((c) => `"${c.connection.label}" (${c.connection.service_name})`).join(', ')}.` : '',
            preApproved.length ? `Pre-approved actions (these run without asking, ONLY for exactly these places):\n${preApproved.join('\n')}\nAny other action that needs approval will pause the run until the owner approves it.` : 'No actions are pre-approved: anything that needs approval will pause the run until the owner approves it.',
            `Automation memory: call automation_memory_read at the start, and automation_memory_write at the end with what the next run needs${a.memory_plan ? ` (plan: ${a.memory_plan})` : ''}. Keep it small.`,
            `Where results go:\n${dest.join('\n')}`,
            `Finish with a short, scannable report of what you did and found. Do not add follow-up questions.`,
        ]
            .filter(Boolean)
            .join('\n\n');
        const user = `${a.skill ? `/${a.skill.slug} ` : ''}Run the automation "${a.name}" now.\n\nInstructions:\n${a.instructions}`;
        return { system, user, automation_id: a.id };
    }
}
