import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import * as webpush from 'web-push';
import { GoogleAuth } from 'google-auth-library';
import { NotificationChannel } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { EventsService, UserEvents } from '@/core/realtime/events.service';
import { MailService } from '@/integrations/mail/mail.service';
import { MailTemplates } from '@/integrations/mail/mail.templates';
import { DEFAULT_CHANNELS } from '@/modules/notifications/notifications.service';

/** Minutes from now until quiet hours end (user's time zone), or 0 when not in quiet hours. */
function quietDelayMs(start?: string | null, end?: string | null, tz = 'UTC'): number {
    if (!start || !end) return 0;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const now = Number(parts.find((p) => p.type === 'hour')!.value) * 60 + Number(parts.find((p) => p.type === 'minute')!.value);
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    const s = toMin(start);
    const e = toMin(end);
    const inQuiet = s <= e ? now >= s && now < e : now >= s || now < e;
    if (!inQuiet) return 0;
    const minutes = (e - now + 1440) % 1440;
    return minutes * 60_000;
}

/** notifications queue (§12): `dispatch` applies settings and quiet hours, then one job per channel. */
@Processor(Queues.NOTIFICATIONS, { concurrency: 20, limiter: { max: 8, duration: 1000 } })
export class NotificationsProcessor extends WorkerHost {
    private readonly logger = new Logger(NotificationsProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
        private readonly mail: MailService,
        private readonly config: ConfigService,
        @InjectQueue(Queues.NOTIFICATIONS) private readonly queue: Queue,
    ) {
        super();
    }

    async process(job: Job<{ notification_id: string; delivery_id?: string }>) {
        if (job.name === Jobs.notifications.DISPATCH) return this.dispatch(job.data.notification_id);
        if (job.name === Jobs.notifications.EMAIL) return this.email(job.data.delivery_id!);
        if (job.name === Jobs.notifications.PUSH) return this.push(job.data.delivery_id!);
    }

    private async dispatch(id: string) {
        const n = await this.prisma.notification.findUnique({ where: { id }, include: { user: { include: { settings: true } } } });
        if (!n) return;
        const pref = await this.prisma.notificationPreference.findUnique({ where: { user_id_event: { user_id: n.user_id, event: n.event } } });
        if (pref && !pref.enabled) return { skipped: 'disabled' };
        const channels: NotificationChannel[] = pref?.channels ?? [...DEFAULT_CHANNELS];
        const s = n.user.settings;
        // Approvals reach the user by email too when they chose "In app + push, also email".
        if (n.event === 'APPROVAL_NEEDED' && s?.approval_channel === 'IN_APP_PUSH_EMAIL' && !channels.includes('EMAIL')) channels.push('EMAIL');

        // In-app is always immediate; quiet hours only delay push/email (urgent approvals still come through).
        if (channels.includes('IN_APP')) {
            await this.events.toUser(n.user_id, UserEvents.NOTIFICATION, { id: n.id, event: n.event, title: n.title, body: n.body, link_path: n.link_path, created_at: n.created_at, is_urgent: n.is_urgent });
            await this.prisma.notificationDelivery.create({ data: { notification_id: n.id, channel: 'IN_APP', status: 'SENT', sent_at: new Date() } });
        }
        const delay = s?.quiet_hours_enabled && !n.is_urgent ? quietDelayMs(s.quiet_hours_start, s.quiet_hours_end, n.user.timezone) : 0;
        for (const channel of channels.filter((c) => c !== 'IN_APP')) {
            const d = await this.prisma.notificationDelivery.create({ data: { notification_id: n.id, channel, status: 'QUEUED', scheduled_for: delay ? new Date(Date.now() + delay) : null } });
            await this.queue.add(channel === 'EMAIL' ? Jobs.notifications.EMAIL : Jobs.notifications.PUSH, { notification_id: n.id, delivery_id: d.id }, { delay, attempts: 5, backoff: { type: 'exponential', delay: 30_000 } });
        }
        return { channels, delay };
    }

    private async email(deliveryId: string) {
        const d = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, include: { notification: { include: { user: true } } } });
        if (!d || d.status === 'SENT') return;
        const n = d.notification;
        const app = (this.config.get<string>('APP_URL') || '').replace(/\/$/, '');
        try {
            await this.mail.send({ to: n.user.email, ...MailTemplates.notification({ title: n.title, body: n.body, url: n.link_path ? `${app}${n.link_path}` : null }) });
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: 'SENT', sent_at: new Date(), attempts: { increment: 1 } } });
        } catch (e) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 500), attempts: { increment: 1 } } });
            throw e;
        }
    }

    /**
     * Web Push to every push-enabled device of the user (§12). Expired subscriptions (404/410) are removed.
     * APNS/FCM devices (desktop/mobile apps) are handled by their own providers when those apps ship.
     */
    private async push(deliveryId: string) {
        const d = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, include: { notification: true } });
        if (!d || d.status === 'SENT') return;
        const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
        const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
        const fcmReady = !!this.fcmConfig();
        const providers = [...(pub && priv ? (['WEBPUSH'] as const) : []), ...(fcmReady ? (['FCM'] as const) : [])];
        const devices = providers.length
            ? await this.prisma.device.findMany({ where: { user_id: d.notification.user_id, push_provider: { in: [...providers] }, push_token: { not: null }, sessions: { some: { revoked_at: null, expires_at: { gt: new Date() } } } } })
            : [];
        if (!devices.length) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: 'SKIPPED', error: providers.length ? 'No push-enabled devices' : 'Push is not configured' } });
            return;
        }
        const n = d.notification;
        const payload = JSON.stringify({ id: n.id, title: n.title, body: n.body ?? '', url: n.link_path ?? '/', event: n.event, urgent: n.is_urgent });
        let sent = 0;
        const errors: string[] = [];
        for (const dev of devices) {
            try {
                if (dev.push_provider === 'FCM') {
                    const gone = await this.sendFcm(dev.push_token!, n);
                    if (gone) await this.prisma.device.update({ where: { id: dev.id }, data: { push_provider: null, push_token: null } });
                    else sent++;
                    continue;
                }
                await webpush.sendNotification(JSON.parse(dev.push_token!), payload, {
                    vapidDetails: { subject: this.config.get<string>('VAPID_SUBJECT') || 'mailto:support@example.com', publicKey: pub!, privateKey: priv! },
                    TTL: n.is_urgent ? 3600 : 24 * 3600,
                    urgency: n.is_urgent ? 'high' : 'normal',
                });
                sent++;
            } catch (e) {
                const status = (e as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) await this.prisma.device.update({ where: { id: dev.id }, data: { push_provider: null, push_token: null } });
                else errors.push(`${status ?? ''} ${(e as Error).message}`.trim());
            }
        }
        await this.prisma.notificationDelivery.update({
            where: { id: d.id },
            data: { status: sent ? 'SENT' : errors.length ? 'FAILED' : 'SKIPPED', sent_at: sent ? new Date() : null, error: errors.join('; ').slice(0, 500) || null, attempts: { increment: 1 } },
        });
        if (!sent && errors.length) throw new Error(errors[0]);
        return { sent };
    }

    /** FCM HTTP v1 (Android app): FCM_PROJECT_ID + FCM_CREDENTIALS_JSON_BASE64 (a service account with Firebase Messaging). */
    private fcmConfig() {
        const projectId = this.config.get<string>('FCM_PROJECT_ID');
        const b64 = this.config.get<string>('FCM_CREDENTIALS_JSON_BASE64');
        return projectId && b64 ? { projectId, credentials: JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) } : null;
    }

    private fcmAuth?: GoogleAuth;

    /** Returns true when the token is no longer valid (the device should stop receiving pushes). */
    private async sendFcm(token: string, n: { id: string; title: string; body: string | null; link_path: string | null; event: string; is_urgent: boolean }) {
        const cfg = this.fcmConfig()!;
        this.fcmAuth ??= new GoogleAuth({ credentials: cfg.credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
        const accessToken = await this.fcmAuth.getAccessToken();
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    token,
                    notification: { title: n.title, body: n.body ?? '' },
                    data: { id: n.id, url: n.link_path ?? '/', event: n.event },
                    android: { priority: n.is_urgent ? 'HIGH' : 'NORMAL', notification: { tag: n.id } },
                },
            }),
        });
        if (res.ok) return false;
        const text = await res.text();
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*registration/i.test(text)) return true;
        throw new Error(`FCM ${res.status}: ${text.slice(0, 200)}`);
    }
}
