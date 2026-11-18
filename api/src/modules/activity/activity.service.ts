import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { paginate } from '@/shared/utils/pagination/pagination.utils';
import type { ActivityQuery } from './dto/activity-query.schema';

export interface ActivityEntry {
    organization_id: string;
    actor_type?: ActorType;
    actor_user_id?: string | null;
    actor_bot_id?: string | null;
    on_behalf_of_id?: string | null;
    action: string;
    target_type?: string;
    target_id?: string;
    connection_id?: string | null;
    run_id?: string | null;
    metadata?: Record<string, unknown>;
    ip_address?: string;
}

/** §11 Transparency — every bot action and admin change is logged (secrets never appear). */
@Injectable()
export class ActivityService {
    private readonly logger = new Logger(ActivityService.name);

    constructor(private readonly prisma: PrismaService) { }

    async log(entry: ActivityEntry) {
        try {
            await this.prisma.activityLog.create({
                data: {
                    organization_id: entry.organization_id,
                    actor_type: entry.actor_type ?? (entry.actor_bot_id ? ActorType.BOT : entry.actor_user_id ? ActorType.USER : ActorType.SYSTEM),
                    actor_user_id: entry.actor_user_id ?? null,
                    actor_bot_id: entry.actor_bot_id ?? null,
                    on_behalf_of_id: entry.on_behalf_of_id ?? null,
                    action: entry.action,
                    target_type: entry.target_type,
                    target_id: entry.target_id,
                    connection_id: entry.connection_id ?? null,
                    run_id: entry.run_id ?? null,
                    metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
                    ip_address: entry.ip_address,
                },
            });
        } catch (e) {
            this.logger.warn(`Activity log failed (${entry.action}): ${(e as Error).message}`);
        }
    }

    async list(orgId: string, q: ActivityQuery) {
        const where: Prisma.ActivityLogWhereInput = {
            organization_id: orgId,
            ...(q.action ? { action: { startsWith: q.action } } : {}),
            ...(q.actor_type ? { actor_type: q.actor_type } : {}),
            ...(q.bot_id ? { actor_bot_id: q.bot_id } : {}),
            ...(q.user_id ? { OR: [{ actor_user_id: q.user_id }, { on_behalf_of_id: q.user_id }] } : {}),
            ...(q.search ? { action: { contains: q.search, mode: 'insensitive' } } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.activityLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (q.page - 1) * q.limit,
                take: q.limit,
                include: {
                    actor_user: { select: { id: true, name: true, email: true } },
                    actor_bot: { select: { id: true, name: true, emoji: true, color: true } },
                    connection: { select: { id: true, label: true } },
                },
            }),
            this.prisma.activityLog.count({ where }),
        ]);
        return paginate(rows, total, q.page, q.limit);
    }
}
