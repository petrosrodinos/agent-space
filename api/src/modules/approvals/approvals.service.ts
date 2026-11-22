import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActionType, BiometricApprovalScope, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import type { Actor } from '../bots/bots.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RunsService } from '../runs/runs.service';
import { ActivityService } from '../activity/activity.service';
import { TAP_ONLY } from '../agent/approval-policy';

export interface CreateApprovalInput {
    organization_id: string;
    run_id: string;
    conversation_id: string | null;
    message_id: string | null;
    bot_id: string;
    requested_from_id: string | null;
    action_type: ActionType;
    title: string;
    preview: Record<string, unknown>;
    tool_call_id: string;
    requires_tap?: boolean;
}

/** Fingerprint / face unlock on mobile (§13.4): payments and website passwords always, plus what the organisation adds. */
const ALWAYS_BIOMETRIC: ActionType[] = [ActionType.PURCHASE_PAYMENT, ActionType.ENTER_PASSWORD];
const BIOMETRIC_SCOPE_ACTIONS: Record<BiometricApprovalScope, ActionType[] | 'all'> = {
    [BiometricApprovalScope.ALL_APPROVALS]: 'all',
    [BiometricApprovalScope.EXTERNAL_EMAILS]: [ActionType.EXTERNAL_EMAIL],
    [BiometricApprovalScope.DELETING_DATA]: [ActionType.DELETE_DATA],
};
export function needsBiometric(action: ActionType, scopes: BiometricApprovalScope[]): boolean {
    if (ALWAYS_BIOMETRIC.includes(action)) return true;
    return scopes.some((s) => { const a = BIOMETRIC_SCOPE_ACTIONS[s]; return a === 'all' || a.includes(action); });
}

const TIMEOUT_MS = { KEEP_WAITING: null, CANCEL_AFTER_1H: 3600_000, CANCEL_AFTER_24H: 86400_000 } as const;

@Injectable()
export class ApprovalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
        private readonly notifications: NotificationsService,
        private readonly runs: RunsService,
        private readonly activity: ActivityService,
        @InjectQueue(Queues.APPROVALS) private readonly queue: Queue,
    ) { }

    /** Creates the approval card (§11) and, when a timeout applies, a delayed `approvals.timeout` job. */
    async create(input: CreateApprovalInput) {
        const [userSettings, orgSettings] = await Promise.all([
            input.requested_from_id ? this.prisma.userSettings.findUnique({ where: { user_id: input.requested_from_id } }) : null,
            this.prisma.organizationSettings.findUnique({ where: { organization_id: input.organization_id } }),
        ]);
        const userMs = TIMEOUT_MS[userSettings?.approval_timeout ?? 'KEEP_WAITING'];
        const orgMs = orgSettings?.approval_timeout_minutes ? orgSettings.approval_timeout_minutes * 60_000 : null;
        const ms = [userMs, orgMs].filter((x): x is number => !!x).sort((a, b) => a - b)[0];
        const requiresTap = input.requires_tap || TAP_ONLY.includes(input.action_type);
        const requiresBiometric = needsBiometric(input.action_type, orgSettings?.biometric_approval_scopes ?? []);
        // Auto-accept only when the organisation timeout is the one that fires, and never for enforced or tap-only actions.
        const autoApprove =
            !!ms && ms === orgMs && orgSettings?.approval_timeout_action === 'APPROVE' && !requiresTap && !orgSettings.enforced_approvals.includes(input.action_type);
        const approval = await this.prisma.approval.create({
            data: {
                organization_id: input.organization_id,
                run_id: input.run_id,
                conversation_id: input.conversation_id,
                message_id: input.message_id,
                bot_id: input.bot_id,
                requested_from_id: input.requested_from_id,
                action_type: input.action_type,
                title: input.title.slice(0, 300),
                preview: input.preview as Prisma.InputJsonValue,
                tool_call_id: input.tool_call_id,
                requires_tap: requiresTap,
                requires_biometric: requiresBiometric,
                is_urgent: input.action_type === 'PURCHASE_PAYMENT',
                timeout_at: ms ? new Date(Date.now() + ms) : null,
            },
            include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } } },
        });
        if (ms) await this.queue.add(Jobs.approvals.TIMEOUT, { approval_id: approval.id, auto_approve: autoApprove }, { jobId: `approval:${approval.id}`, delay: ms, attempts: 3 });
        if (input.conversation_id) await this.events.toConversation(input.conversation_id, ConversationEvents.APPROVAL_CREATED, approval);
        if (input.requested_from_id) {
            await this.events.toUser(input.requested_from_id, UserEvents.APPROVALS_CHANGED, { approval_id: approval.id });
            await this.notifications.notify({
                user_id: input.requested_from_id,
                organization_id: input.organization_id,
                event: 'APPROVAL_NEEDED',
                title: `${approval.bot.name} needs your approval`,
                body: approval.title,
                link_path: input.conversation_id ? `/c/${input.conversation_id}` : `/approvals/${approval.id}`,
                data: { approval_id: approval.id, approval_title: approval.title, requires_biometric: requiresBiometric },
                is_urgent: approval.is_urgent,
            });
        }
        return approval;
    }

    list(actor: Actor, status: 'pending' | 'all' = 'pending') {
        return this.prisma.approval.findMany({
            where: { organization_id: actor.organization_id, requested_from_id: actor.user_id, ...(status === 'pending' ? { status: 'PENDING' } : {}) },
            include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } }, conversation: { select: { id: true, name: true, type: true } } },
            orderBy: { created_at: 'desc' },
            take: 100,
        });
    }

    async get(actor: Actor, id: string) {
        const a = await this.prisma.approval.findFirst({
            where: { id, organization_id: actor.organization_id },
            include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } }, conversation: { select: { id: true, name: true } }, resolved_by: { select: { id: true, name: true } } },
        });
        if (!a) throw new NotFoundException('Approval not found');
        if (a.requested_from_id !== actor.user_id) {
            const visible = a.conversation_id ? await this.prisma.conversationParticipant.count({ where: { conversation_id: a.conversation_id, user_id: actor.user_id, left_at: null } }) : 0;
            if (!visible) throw new NotFoundException('Approval not found');
        }
        return a;
    }

    /** Approve / Edit / Reject (§11). Resolving adds a `resume` job for the waiting run. */
    async resolve(actor: Actor, id: string, decision: 'approve' | 'reject', edited?: Record<string, unknown>, viaVoice = false) {
        const a = await this.get(actor, id);
        if (a.requested_from_id && a.requested_from_id !== actor.user_id) throw new ForbiddenException('This approval is for someone else');
        if (a.status !== 'PENDING') throw new BadRequestException(`This request was already ${a.status.toLowerCase().replace('_', ' ')}`);
        if (viaVoice && a.requires_tap) throw new BadRequestException('This action needs a tap on the approval card');
        const status = decision === 'reject' ? 'REJECTED' : edited ? 'EDITED_APPROVED' : 'APPROVED';
        const res = await this.prisma.approval.updateMany({
            where: { id, status: 'PENDING' },
            data: { status, resolved_by_id: actor.user_id, resolved_at: new Date(), edited_payload: (edited ?? undefined) as Prisma.InputJsonValue, resolved_via_voice: viaVoice },
        });
        if (!res.count) throw new BadRequestException('This request was already answered');
        await this.queue.remove(`approval:${id}`).catch(() => undefined);
        await this.afterResolved(a.id);
        await this.activity.log({ organization_id: a.organization_id, actor_user_id: actor.user_id, action: `approval.${status.toLowerCase()}`, target_type: 'approval', target_id: id, run_id: a.run_id, metadata: { action_type: a.action_type, title: a.title } });
        return this.get(actor, id);
    }

    /**
     * Timeout job: cancel the approval (the run ends as failed per §10.3 / §13.2), or — when the organisation
     * chose "Accept automatically" — approve it and let the run continue.
     */
    async expire(id: string, autoApprove = false) {
        const status = autoApprove ? 'APPROVED' : 'EXPIRED';
        const res = await this.prisma.approval.updateMany({ where: { id, status: 'PENDING' }, data: { status, resolved_at: new Date() } });
        if (!res.count) return;
        await this.afterResolved(id);
        if (autoApprove) {
            const a = await this.prisma.approval.findUniqueOrThrow({ where: { id } });
            await this.activity.log({ organization_id: a.organization_id, actor_user_id: null, action: 'approval.auto_approved', target_type: 'approval', target_id: id, run_id: a.run_id, metadata: { action_type: a.action_type, title: a.title } });
        }
    }

    private async afterResolved(id: string) {
        const a = await this.prisma.approval.findUniqueOrThrow({ where: { id }, include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } } } });
        if (a.conversation_id) await this.events.toConversation(a.conversation_id, ConversationEvents.APPROVAL_RESOLVED, a);
        if (a.requested_from_id) await this.events.toUser(a.requested_from_id, UserEvents.APPROVALS_CHANGED, { approval_id: id });
        const run = await this.prisma.run.findUnique({ where: { id: a.run_id } });
        if (run?.status === 'WAITING_APPROVAL') {
            await this.prisma.run.update({ where: { id: run.id }, data: { status: 'QUEUED' } });
            await this.runs.resume(run.id, 'approval');
        }
    }
}
