import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ComposioService, ComposioToolError } from '@/integrations/composio/composio.service';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { MessageEventsService } from '../conversations/message-events.service';

interface StoredUndo {
    tool: string;
    args: Record<string, unknown>;
    label: string;
    connection_id: string;
}

/**
 * Undo (§16): reverses a bot's action in a connected service when the service allows it (deleting the event it
 * created, the message it posted…). Only the person the bot acted for can undo, within the window, once.
 */
@Injectable()
export class RunUndoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly composio: ComposioService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly messageEvents: MessageEventsService,
    ) { }

    async undo(actor: Actor, runId: string, stepId: string) {
        const step = await this.prisma.runStep.findFirst({ where: { id: stepId, run_id: runId }, include: { run: { select: { id: true, user_id: true, organization_id: true, bot_id: true } } } });
        if (!step || step.run.organization_id !== actor.organization_id) throw new NotFoundException('Step not found');
        if (step.run.user_id !== actor.user_id) throw new ForbiddenException('Only the person the bot acted for can undo this');
        const plan = step.undo as unknown as StoredUndo | null;
        if (!plan) throw new BadRequestException('This action can’t be undone');
        if (step.undone_at) throw new BadRequestException('Already undone');
        if (!step.undo_until || step.undo_until.getTime() < Date.now()) throw new BadRequestException('It’s too late to undo this');

        const conn = await this.prisma.connection.findFirst({ where: { id: plan.connection_id, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id), status: 'ACTIVE' } });
        if (!conn?.composio_connected_account_id) throw new BadRequestException('The connected account it used is no longer available. Reconnect it, then try again.');
        const userId = conn.composio_user_id ?? (await this.composio.getConnectedAccount(conn.composio_connected_account_id)).user_id;
        try {
            await this.composio.executeTool(plan.tool, conn.composio_connected_account_id, userId!, plan.args);
        } catch (e) {
            const detail = e instanceof ComposioToolError ? e.detail : (e as Error).message;
            await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'action.undo_failed', target_type: 'run_step', target_id: stepId, connection_id: conn.id, run_id: runId, metadata: { tool: plan.tool, error: detail.slice(0, 300) } });
            throw new BadRequestException(`${conn.service_name} didn’t allow it: ${detail.slice(0, 200)}`);
        }
        await this.prisma.runStep.update({ where: { id: stepId }, data: { undone_at: new Date(), undone_by_id: actor.user_id } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'action.undone', target_type: 'run_step', target_id: stepId, connection_id: conn.id, run_id: runId, metadata: { tool: plan.tool, label: plan.label } });

        // Mark the step in the bot's message so everyone in the conversation (and the bot, next turn) sees it was undone.
        const message = await this.prisma.message.findFirst({ where: { run_id: runId, author_type: 'BOT' }, orderBy: { created_at: 'desc' } });
        if (message) {
            const parts = ((message.parts ?? []) as Record<string, unknown>[]).map((p) => (p.type === 'tool' && p.step_id === stepId ? { ...p, undone: true, undo: undefined } : p));
            parts.push({ type: 'notice', text: `Undone: ${plan.label.charAt(0).toLowerCase()}${plan.label.slice(1)}.` });
            await this.prisma.message.update({ where: { id: message.id }, data: { parts: parts as unknown as Prisma.InputJsonValue } });
            await this.messageEvents.publish(message.id);
        }
        return { ok: true, label: plan.label };
    }
}
