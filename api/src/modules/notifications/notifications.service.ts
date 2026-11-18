import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationChannel, NotificationEvent, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { paginate, PaginationQuery } from '@/shared/utils/pagination/pagination.utils';

export interface NotifyInput {
    user_id: string;
    organization_id?: string | null;
    event: NotificationEvent;
    title: string;
    body?: string | null;
    link_path?: string | null;
    data?: Record<string, unknown>;
    is_urgent?: boolean;
}

/** Default channels per event when the user has no saved preference (§12, §13.2). */
export const DEFAULT_CHANNELS: Partial<Record<NotificationEvent, NotificationChannel[]>> = {
    INVITATION_RECEIVED: ['IN_APP', 'EMAIL'],
    EXPORT_READY: ['IN_APP', 'EMAIL'],
};

@Injectable()
export class NotificationsService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(Queues.NOTIFICATIONS) private readonly queue: Queue,
    ) { }

    /** Creates the notification record and adds a `dispatch` job that applies settings and fans out per channel (§12). */
    async notify(input: NotifyInput) {
        const n = await this.prisma.notification.create({
            data: {
                user_id: input.user_id,
                organization_id: input.organization_id ?? null,
                event: input.event,
                title: input.title.slice(0, 300),
                body: input.body?.slice(0, 2000) ?? null,
                link_path: input.link_path ?? null,
                data: (input.data ?? undefined) as Prisma.InputJsonValue,
                is_urgent: !!input.is_urgent,
            },
        });
        await this.queue.add(Jobs.notifications.DISPATCH, { notification_id: n.id }, { attempts: 5, backoff: { type: 'exponential', delay: 30_000 } });
        return n;
    }

    async notifyMany(userIds: string[], input: Omit<NotifyInput, 'user_id'>) {
        await Promise.all([...new Set(userIds)].map((user_id) => this.notify({ ...input, user_id })));
    }

    async list(userId: string, q: PaginationQuery & { unread?: boolean }) {
        const where: Prisma.NotificationWhereInput = { user_id: userId, ...(q.unread ? { read_at: null } : {}) };
        const [rows, total, unread] = await Promise.all([
            this.prisma.notification.findMany({ where, orderBy: { created_at: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({ where: { user_id: userId, read_at: null } }),
        ]);
        return { ...paginate(rows, total, q.page, q.limit), unread };
    }

    async markRead(userId: string, id: string) {
        const res = await this.prisma.notification.updateMany({ where: { id, user_id: userId }, data: { read_at: new Date() } });
        if (!res.count) throw new NotFoundException('Notification not found');
        return { ok: true };
    }

    async markAllRead(userId: string) {
        await this.prisma.notification.updateMany({ where: { user_id: userId, read_at: null }, data: { read_at: new Date() } });
        return { ok: true };
    }

    async getPreferences(userId: string) {
        const saved = await this.prisma.notificationPreference.findMany({ where: { user_id: userId } });
        const byEvent = new Map(saved.map((p) => [p.event, p]));
        return Object.values(NotificationEvent).map((event) => {
            const p = byEvent.get(event);
            return {
                event,
                enabled: p?.enabled ?? true,
                channels: p?.channels ?? DEFAULT_CHANNELS[event] ?? (['IN_APP', 'PUSH'] as NotificationChannel[]),
            };
        });
    }

    async updatePreference(userId: string, event: NotificationEvent, enabled: boolean, channels: NotificationChannel[]) {
        await this.prisma.notificationPreference.upsert({
            where: { user_id_event: { user_id: userId, event } },
            create: { user_id: userId, event, enabled, channels },
            update: { enabled, channels },
        });
        return this.getPreferences(userId);
    }
}
