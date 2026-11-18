import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, RunStatus, RunType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { Jobs, Queues, RunPriority } from '@/core/queues/queues.constants';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import { paginate } from '@/shared/utils/pagination/pagination.utils';
import type { Actor } from '../bots/bots.service';

export interface StartRunInput {
    organization_id: string;
    conversation_id: string | null;
    bot_id: string;
    user_id: string | null;
    type: RunType;
    trigger_message_id?: string | null;
    skill_id?: string | null;
    title?: string | null;
    model_override_id?: string | null;
    branch_from_message_id?: string | null;
    parent_run_id?: string | null;
    requested_by_bot_id?: string | null;
    automation_run_id?: string | null;
}

export const ACTIVE_RUN_STATUSES: RunStatus[] = ['QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'WAITING_INPUT', 'WAITING_DEVICE', 'WAITING_COMPUTER'];

/** The agent-runs side of the API: creates run records and queues them; never does the work in the request (§14.4). */
@Injectable()
export class RunsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly events: EventsService,
        @InjectQueue(Queues.AGENT_RUNS) private readonly queue: Queue,
    ) { }

    async start(input: StartRunInput) {
        const priority = { CHAT_REPLY: RunPriority.CHAT_REPLY, BOT_TO_BOT: RunPriority.BOT_TO_BOT, TASK: RunPriority.TASK, AUTOMATION_RUN: RunPriority.AUTOMATION_RUN }[input.type];
        const bot = await this.prisma.bot.findUniqueOrThrow({ where: { id: input.bot_id } });
        const deadlineMinutes = { MIN_15: 15, HOUR_1: 60, HOUR_4: 240, HOUR_24: 1440 }[bot.max_task_duration];
        const run = await this.prisma.run.create({
            data: {
                organization_id: input.organization_id,
                conversation_id: input.conversation_id,
                bot_id: input.bot_id,
                user_id: input.user_id,
                type: input.type,
                priority,
                title: input.title?.slice(0, 200) ?? null,
                trigger_message_id: input.trigger_message_id ?? null,
                skill_id: input.skill_id ?? null,
                parent_run_id: input.parent_run_id ?? null,
                requested_by_bot_id: input.requested_by_bot_id ?? null,
                automation_run_id: input.automation_run_id ?? null,
                deadline_at: new Date(Date.now() + deadlineMinutes * 60_000),
                state: { model_override_id: input.model_override_id ?? null, branch_from_message_id: input.branch_from_message_id ?? null } as Prisma.InputJsonValue,
            },
        });
        await this.queue.add(Jobs.agentRuns.RUN, { run_id: run.id }, { jobId: run.id, priority });
        if (run.conversation_id) await this.events.toConversation(run.conversation_id, ConversationEvents.RUN_STATUS, { run_id: run.id, bot_id: run.bot_id, status: run.status });
        if (run.user_id) await this.events.toUser(run.user_id, UserEvents.TASK_UPDATED, { run_id: run.id, status: run.status });
        return run;
    }

    /** Adds a `resume` job for a run that was waiting for approval or input (§14.4 "Waiting doesn't hold a worker"). */
    async resume(runId: string, reason: string) {
        await this.queue.add(Jobs.agentRuns.RESUME, { run_id: runId, reason }, { jobId: `${runId}:resume:${Date.now()}`, priority: RunPriority.CHAT_REPLY });
    }

    private async requireRun(actor: Actor, id: string) {
        const run = await this.prisma.run.findFirst({ where: { id, organization_id: actor.organization_id } });
        if (!run) throw new NotFoundException('Task not found');
        if (run.user_id !== actor.user_id) {
            const visible = run.conversation_id
                ? await this.prisma.conversationParticipant.count({ where: { conversation_id: run.conversation_id, user_id: actor.user_id, left_at: null } })
                : 0;
            if (!visible) throw new NotFoundException('Task not found');
        }
        return run;
    }

    /** "Stop" (§7.2): sets the cancel flag the run loop checks between steps and before every tool call. */
    async stop(actor: Actor, id: string) {
        const run = await this.requireRun(actor, id);
        if (!ACTIVE_RUN_STATUSES.includes(run.status)) return { ok: true, status: run.status };
        await this.redis.client.set(this.redis.key(RedisKeys.runCancel(id)), '1', 'EX', 3600);
        if (run.status !== 'RUNNING') {
            // Not on a worker right now: finish it here.
            const job = await this.queue.getJob(id);
            await job?.remove().catch(() => undefined);
            await this.prisma.run.update({ where: { id }, data: { status: 'STOPPED', finished_at: new Date() } });
            await this.prisma.approval.updateMany({ where: { run_id: id, status: 'PENDING' }, data: { status: 'CANCELLED', resolved_at: new Date() } });
            await this.prisma.message.updateMany({ where: { run_id: id, status: { in: ['PENDING', 'STREAMING'] } }, data: { status: 'STOPPED' } });
            if (run.conversation_id) await this.events.toConversation(run.conversation_id, ConversationEvents.RUN_STATUS, { run_id: id, bot_id: run.bot_id, status: 'STOPPED' });
            if (run.user_id) await this.events.toUser(run.user_id, UserEvents.TASK_UPDATED, { run_id: id, status: 'STOPPED' });
        }
        return { ok: true };
    }

    /** Answer from an interactive input the run was waiting on, e.g. the secure secret box (§8.8). */
    async provideInput(actor: Actor, id: string, requestId: string, result: Record<string, unknown>) {
        const run = await this.requireRun(actor, id);
        if (run.status !== 'WAITING_INPUT') throw new BadRequestException('This task is not waiting for input');
        const state = (run.state ?? {}) as Record<string, any>;
        const pending = state.pending_input;
        if (!pending || pending.request_id !== requestId) throw new BadRequestException('Unknown input request');
        if (pending.for_user_id && pending.for_user_id !== actor.user_id) throw new BadRequestException('This request is for someone else');
        state.pending_input = { ...pending, result };
        await this.prisma.run.update({ where: { id }, data: { state: state as Prisma.InputJsonValue, status: 'QUEUED' } });
        await this.resume(id, 'input');
        return { ok: true };
    }

    async listTasks(actor: Actor, q: { status?: string; page: number; limit: number }) {
        const statusFilter: Prisma.RunWhereInput =
            q.status === 'active'
                ? { status: { in: ['QUEUED', 'RUNNING'] } }
                : q.status === 'waiting'
                    ? { status: { in: ['WAITING_APPROVAL', 'WAITING_INPUT', 'WAITING_DEVICE', 'WAITING_COMPUTER'] } }
                    : q.status === 'done'
                        ? { status: 'COMPLETED' }
                        : q.status === 'failed'
                            ? { status: { in: ['FAILED', 'STOPPED'] } }
                            : {};
        const where: Prisma.RunWhereInput = {
            organization_id: actor.organization_id,
            user_id: actor.user_id,
            type: { in: ['TASK', 'CHAT_REPLY', 'AUTOMATION_RUN'] },
            ...statusFilter,
        };
        const [rows, total] = await Promise.all([
            this.prisma.run.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (q.page - 1) * q.limit,
                take: q.limit,
                include: {
                    bot: { select: { id: true, name: true, emoji: true, color: true } },
                    conversation: { select: { id: true, name: true, type: true } },
                    trigger_message: { select: { content: true } },
                    model: { select: { name: true } },
                    _count: { select: { steps: true, approvals: { where: { status: 'PENDING' } } } },
                },
            }),
            this.prisma.run.count({ where }),
        ]);
        const shaped = rows.map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            title: r.title ?? r.trigger_message?.content?.slice(0, 120) ?? 'Task',
            bot: r.bot,
            conversation: r.conversation,
            model: r.model,
            error: r.error,
            steps: r._count.steps,
            pending_approvals: r._count.approvals,
            cost: Number(r.cost),
            input_tokens: r.input_tokens,
            output_tokens: r.output_tokens,
            queued_at: r.queued_at,
            started_at: r.started_at,
            finished_at: r.finished_at,
        }));
        return paginate(shaped, total, q.page, q.limit);
    }

    async getTask(actor: Actor, id: string) {
        await this.requireRun(actor, id);
        const r = await this.prisma.run.findUniqueOrThrow({
            where: { id },
            include: {
                bot: { select: { id: true, name: true, emoji: true, color: true } },
                conversation: { select: { id: true, name: true, type: true } },
                steps: { orderBy: { sequence: 'asc' } },
                approvals: { orderBy: { created_at: 'asc' } },
                model: { select: { name: true, openrouter_id: true } },
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { state, ...rest } = r;
        return { ...rest, cost: Number(r.cost) };
    }
}
