import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyStandardWebhook } from '@/shared/utils/security/webhook-signature.utils';
import { Connection } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { ComposioService, ComposioTriggerType } from '@/integrations/composio/composio.service';
import { AccessService } from '../access/access.service';
import type { Actor } from '../bots/bots.service';

const TYPES_CACHE_SECONDS = 600;
/** Webhooks older than this are refused (replay protection, Standard Webhooks). */
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;
const EVENT_DEDUPE_SECONDS = 24 * 3600;
/** The event shown to the bot is trimmed so a huge email can't fill the prompt. */
const MAX_EVENT_CHARS = 8000;

export interface TriggerChoice {
    connection_id: string;
    trigger_slug: string;
    config?: Record<string, unknown>;
}

export interface TriggerEvent {
    event_id: string;
    trigger_id: string;
    trigger_slug: string | null;
    data: unknown;
    received_at: string;
}

/**
 * Triggers from events in connected services (§10.2): Composio watches the event on the owner's connected account and
 * calls our webhook; the matching automation then runs with the event as its input.
 */
@Injectable()
export class AutomationTriggersService {
    private readonly logger = new Logger(AutomationTriggersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly composio: ComposioService,
        private readonly access: AccessService,
        private readonly config: ConfigService,
    ) { }

    /** Events the owner's connection can start an automation with (cached per service). */
    async typesFor(actor: Actor, connectionId: string): Promise<{ connection: { id: string; label: string; service_name: string; service_key: string }; triggers: ComposioTriggerType[] }> {
        const conn = await this.usableConnection(actor, connectionId);
        const key = this.redis.key(`cache:composio:triggers:${conn.service_key}`);
        const cached = await this.redis.client.get(key);
        let triggers: ComposioTriggerType[];
        if (cached) triggers = JSON.parse(cached);
        else {
            triggers = await this.composio.listTriggerTypes(conn.service_key);
            await this.redis.client.set(key, JSON.stringify(triggers), 'EX', TYPES_CACHE_SECONDS);
        }
        return { connection: { id: conn.id, label: conn.label, service_name: conn.service_name, service_key: conn.service_key }, triggers };
    }

    private async usableConnection(actor: Actor, connectionId: string): Promise<Connection> {
        const conn = await this.prisma.connection.findFirst({ where: { id: connectionId, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } });
        if (!conn) throw new NotFoundException('Connection not found');
        if (conn.kind !== 'COMPOSIO' || !conn.composio_connected_account_id) throw new BadRequestException(`${conn.service_name} connected with an access key can't start automations. Connect it through its sign-in instead.`);
        if (conn.status !== 'ACTIVE') throw new BadRequestException(`Reconnect "${conn.label}" on the Connections page first.`);
        return conn;
    }

    /** Checks the choice before the automation is saved: the connection works and the event exists for that service. */
    async validate(actor: Actor, choice: TriggerChoice) {
        const { connection, triggers } = await this.typesFor(actor, choice.connection_id);
        const type = triggers.find((t) => t.slug === choice.trigger_slug.toUpperCase());
        if (!type) throw new BadRequestException(`${connection.service_name} has no event called ${choice.trigger_slug}`);
        const required = ((type.config as { required?: string[] }).required ?? []).filter((k) => choice.config?.[k] === undefined || choice.config?.[k] === '');
        if (required.length) throw new BadRequestException(`Fill in: ${required.join(', ')}`);
        return { connection, type };
    }

    /** Starts watching (or re-enables) every trigger of an automation. Called on create, resume and after duplicates. */
    async subscribe(automationId: string) {
        const subs = await this.prisma.automationTriggerSubscription.findMany({ where: { automation_id: automationId }, include: { connection: true } });
        for (const s of subs) {
            const conn = s.connection;
            if (!conn.composio_connected_account_id) throw new BadRequestException(`"${conn.label}" can't be watched`);
            if (s.composio_trigger_id) {
                await this.composio.setTriggerEnabled(s.composio_trigger_id, true);
                continue;
            }
            const userId = conn.composio_user_id ?? (await this.composio.getConnectedAccount(conn.composio_connected_account_id)).user_id;
            if (!userId) throw new BadRequestException(`Reconnect "${conn.label}" first`);
            const triggerId = await this.composio.upsertTrigger(s.trigger_key, conn.composio_connected_account_id, userId, (s.config ?? {}) as Record<string, unknown>);
            await this.prisma.automationTriggerSubscription.update({ where: { id: s.id }, data: { composio_trigger_id: triggerId } });
        }
    }

    async disable(automationId: string) {
        const subs = await this.prisma.automationTriggerSubscription.findMany({ where: { automation_id: automationId, composio_trigger_id: { not: null } } });
        for (const s of subs) await this.composio.setTriggerEnabled(s.composio_trigger_id!, false).catch((e) => this.logger.warn(`Disable trigger ${s.composio_trigger_id}: ${(e as Error).message}`));
    }

    /** Stops watching for good and removes the subscriptions (automation deleted, or switched to a schedule). */
    async unsubscribe(automationId: string) {
        const subs = await this.prisma.automationTriggerSubscription.findMany({ where: { automation_id: automationId } });
        for (const s of subs) if (s.composio_trigger_id) await this.composio.deleteTrigger(s.composio_trigger_id).catch((e) => this.logger.warn(`Delete trigger ${s.composio_trigger_id}: ${(e as Error).message}`));
        await this.prisma.automationTriggerSubscription.deleteMany({ where: { automation_id: automationId } });
    }

    // ---------------- Webhook ----------------

    /**
     * Verifies a Composio webhook (Standard Webhooks: HMAC-SHA256 of "id.timestamp.body", base64, `v1,` prefix) and
     * returns the event. Refuses unsigned, stale or replayed deliveries.
     */
    async verify(headers: Record<string, string | string[] | undefined>, rawBody: Buffer | undefined): Promise<TriggerEvent | null> {
        const secret = this.config.get<string>('COMPOSIO_WEBHOOK_SECRET');
        if (!secret) throw new ServiceUnavailableException('Connected-service events are not set up (COMPOSIO_WEBHOOK_SECRET)');
        const h = (k: string) => {
            const v = headers[k];
            return Array.isArray(v) ? v[0] : v;
        };
        const id = h('webhook-id');
        const ts = h('webhook-timestamp');
        const sig = h('webhook-signature');
        if (!id || !ts || !sig || !rawBody) throw new UnauthorizedException('Missing webhook signature');
        if (!verifyStandardWebhook({ secret, id, timestamp: ts, signature: sig, body: rawBody.toString('utf8'), maxAgeSeconds: MAX_WEBHOOK_AGE_SECONDS })) throw new UnauthorizedException('Bad or stale webhook signature');

        const fresh = await this.redis.client.set(this.redis.key(`webhook:composio:${id}`), '1', 'EX', EVENT_DEDUPE_SECONDS, 'NX');
        if (!fresh) return null; // already handled (Composio retries)
        let body: any;
        try {
            body = JSON.parse(rawBody.toString('utf8'));
        } catch {
            throw new BadRequestException('Invalid JSON');
        }
        // v3 shape: { type: "composio.trigger.message", metadata: { trigger_id, trigger_slug, … }, data }; older shapes put the ids elsewhere.
        const triggerId = body?.metadata?.trigger_id ?? body?.trigger_id ?? body?.data?.trigger_id ?? body?.metadata?.id ?? null;
        if (!triggerId) return null;
        const slug = body?.metadata?.trigger_slug ?? body?.trigger_slug ?? (typeof body?.type === 'string' && body.type !== 'composio.trigger.message' ? String(body.type).toUpperCase() : null);
        return { event_id: id, trigger_id: String(triggerId), trigger_slug: slug, data: body?.data ?? body?.payload ?? null, received_at: new Date().toISOString() };
    }

    /** The subscription an event belongs to, with its automation. */
    findSubscription(triggerId: string) {
        return this.prisma.automationTriggerSubscription.findUnique({ where: { composio_trigger_id: triggerId }, include: { connection: { select: { label: true, service_name: true } } } });
    }

    /** Trims the event for the prompt and the run history. */
    trimEvent(e: TriggerEvent) {
        const json = JSON.stringify(e.data ?? null);
        return { ...e, data: json.length > MAX_EVENT_CHARS ? { truncated: true, preview: json.slice(0, MAX_EVENT_CHARS) } : e.data };
    }
}
