import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { ComposioService, ComposioToolError, ToolFailureKinds } from '@/integrations/composio/composio.service';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import { classifyToolSlug } from '../agent/approval-policy';
import type { Actor } from '../bots/bots.service';
import { ArtifactsService } from './artifacts.service';

const ACTION_RE = /^[A-Z][A-Z0-9_]{2,99}$/;
const CALLS_PER_MINUTE = 60;
const MAX_RESULT_BYTES = 300_000;

/** What the page gets back when the viewer still has to allow access (shown by the app, never by the page). */
export class NeedsPermissionError extends ForbiddenException {
    constructor(service: { key: string; name: string }) {
        super({ statusCode: 403, code: 'needs_permission', message: `Allow this page to read your ${service.name} data first.`, service: service.key, service_name: service.name });
    }
}

/**
 * "Show live data" (§7.5): an artifact reads the viewer's own connected accounts through `agentspace.live(action, params)`.
 * Members only (never public links), read-only actions only, each viewer's own connection and access, and only after
 * that viewer allowed the artifact for that service once.
 */
@Injectable()
export class ArtifactLiveDataService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly composio: ComposioService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly artifacts: ArtifactsService,
    ) { }

    /** The viewer's usable, working connection for the service an action belongs to (`HUBSPOT_LIST_DEALS` → hubspot). */
    private async connectionFor(orgId: string, userId: string, action: string): Promise<Connection | null> {
        const conns = await this.prisma.connection.findMany({ where: { ...this.access.usableConnectionsWhere(orgId, userId), kind: 'COMPOSIO', status: 'ACTIVE', composio_connected_account_id: { not: null } }, orderBy: { created_at: 'asc' } });
        const defaults = await this.prisma.userServiceDefault.findMany({ where: { user_id: userId, organization_id: orgId } });
        const matching = conns.filter((c) => action.toLowerCase().startsWith(`${c.service_key.toLowerCase().replace(/[^a-z0-9]/g, '')}_`) || action.toLowerCase().startsWith(`${c.service_key.toLowerCase()}_`));
        return matching.find((c) => defaults.some((d) => d.connection_id === c.id)) ?? matching.find((c) => c.owner_id === userId) ?? matching[0] ?? null;
    }

    async call(artifact: { id: string; organization_id: string; title: string }, userId: string, body: { action?: unknown; params?: unknown }) {
        const action = String(body.action ?? '').toUpperCase();
        if (!ACTION_RE.test(action)) throw new BadRequestException('Name a connected-service action, e.g. HUBSPOT_LIST_DEALS');
        const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? (body.params as Record<string, unknown>) : {};
        if (classifyToolSlug(action, params)) throw new ForbiddenException('Live data can only read information. Pages cannot send, change or delete anything in connected accounts.');

        const key = this.redis.key(`artifact-live:${artifact.id}:${userId}:${Math.floor(Date.now() / 60_000)}`);
        const n = await this.redis.client.incr(key);
        if (n === 1) await this.redis.client.expire(key, 120);
        if (n > CALLS_PER_MINUTE) throw new ForbiddenException('Too many live data requests. Try again in a minute.');

        const conn = await this.connectionFor(artifact.organization_id, userId, action);
        if (!conn) throw new NotFoundException('You have no working connection for this service. Connect it on the Connections page.');
        const granted = await this.prisma.artifactDataGrant.findUnique({ where: { artifact_id_user_id_service_key: { artifact_id: artifact.id, user_id: userId, service_key: conn.service_key } } });
        if (!granted) throw new NeedsPermissionError({ key: conn.service_key, name: conn.service_name });

        const userIdForComposio = conn.composio_user_id ?? (await this.composio.getConnectedAccount(conn.composio_connected_account_id!)).user_id;
        if (!userIdForComposio) throw new BadRequestException(`${conn.service_name}: reconnect this account on the Connections page.`);
        const log = (successful: boolean, failure?: string) =>
            this.activity.log({ organization_id: artifact.organization_id, actor_user_id: userId, action: 'connection.used', target_type: 'artifact', target_id: artifact.id, connection_id: conn.id, metadata: { successful, failure, tool: action, via: 'artifact_live_data' } });
        try {
            const res = await this.composio.executeTool(action, conn.composio_connected_account_id!, userIdForComposio, params);
            await this.prisma.connection.update({ where: { id: conn.id }, data: { last_used_at: new Date() } });
            await log(true);
            const json = JSON.stringify(res.data ?? null);
            return { data: json.length > MAX_RESULT_BYTES ? { truncated: true, preview: json.slice(0, MAX_RESULT_BYTES) } : res.data, account: conn.label };
        } catch (e) {
            if (!(e instanceof ComposioToolError)) throw new BadRequestException(`${conn.service_name} could not be read: ${(e as Error).message.slice(0, 200)}`);
            await log(false, e.kind);
            if (e.kind === ToolFailureKinds.NEEDS_RECONNECTING) throw new ForbiddenException(`Your ${conn.service_name} sign-in expired. Reconnect it on the Connections page.`);
            throw new BadRequestException(e.kind === ToolFailureKinds.SERVICE_ERROR ? `${conn.service_name}: ${e.detail.slice(0, 300)}` : `Couldn't reach ${conn.service_name} right now. Try again later.`);
        }
    }

    // ---- grants, managed from the app (trusted UI, never from the page) ----

    async grants(actor: Actor, artifactId: string) {
        await this.artifacts.require(actor, artifactId, 'VIEWER');
        const rows = await this.prisma.artifactDataGrant.findMany({ where: { artifact_id: artifactId, user_id: actor.user_id }, orderBy: { created_at: 'asc' } });
        const names = await this.prisma.connection.findMany({ where: { organization_id: actor.organization_id, service_key: { in: rows.map((r) => r.service_key) } }, select: { service_key: true, service_name: true }, distinct: ['service_key'] });
        return rows.map((r) => ({ service: r.service_key, service_name: names.find((n) => n.service_key === r.service_key)?.service_name ?? r.service_key, created_at: r.created_at }));
    }

    async grant(actor: Actor, artifactId: string, service: string) {
        const { artifact } = await this.artifacts.require(actor, artifactId, 'VIEWER');
        const has = await this.prisma.connection.count({ where: { ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id), service_key: service, status: 'ACTIVE' } });
        if (!has) throw new NotFoundException('You have no working connection for this service');
        await this.prisma.artifactDataGrant.upsert({ where: { artifact_id_user_id_service_key: { artifact_id: artifactId, user_id: actor.user_id, service_key: service } }, create: { artifact_id: artifactId, user_id: actor.user_id, service_key: service }, update: {} });
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.live_data_allowed', target_type: 'artifact', target_id: artifactId, metadata: { service } });
        return this.grants(actor, artifactId);
    }

    async revoke(actor: Actor, artifactId: string, service: string) {
        await this.artifacts.require(actor, artifactId, 'VIEWER');
        await this.prisma.artifactDataGrant.deleteMany({ where: { artifact_id: artifactId, user_id: actor.user_id, service_key: service } });
        return this.grants(actor, artifactId);
    }
}
