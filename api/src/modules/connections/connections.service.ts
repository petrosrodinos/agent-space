import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService, UserEvents } from '@/core/realtime/events.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { ComposioService, ComposioTool } from '@/integrations/composio/composio.service';
import { SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { AccessService, isAdminRole } from '../access/access.service';
import { classifyToolSlug } from '../agent/approval-policy';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { CredentialsService } from './credentials.service';
import { CatalogQuery, ConnectComposioDto, CreateApiKeyConnectionDto, SetToolPermissionsDto, ToolPermissions, UpdateConnectionDto } from './dto/connection.dto';

const CONN_INCLUDE = {
    owner: { select: { id: true, name: true, email: true } },
    bot_restrictions: { include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } } } },
    credential: { select: { id: true, masked_hint: true, status: true } },
} satisfies Prisma.ConnectionInclude;

const ALL_TOOLS_CACHE_SECONDS = 600;

/** How the service details page groups tools: read-only ones never need approval at the default level. */
export const ToolGroups = { READ: 'READ', WRITE: 'WRITE' } as const;

@Injectable()
export class ConnectionsService {
    private readonly logger = new Logger(ConnectionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly composio: ComposioService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly credentials: CredentialsService,
        private readonly events: EventsService,
        private readonly config: ConfigService,
        private readonly store: SecretStoreService,
        private readonly redis: RedisService,
    ) { }

    async catalog(actor: Actor, q: CatalogQuery) {
        const [res, mine, settings] = await Promise.all([
            this.composio.listToolkits({ search: q.search, category: q.category, cursor: q.cursor }),
            this.prisma.connection.groupBy({ by: ['service_key'], where: this.access.usableConnectionsWhere(actor.organization_id, actor.user_id), _count: true }),
            this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } }),
        ]);
        const counts = new Map(mine.map((m) => [m.service_key, m._count]));
        return {
            items: res.items
                .filter((t) => !t.no_auth)
                .map((t) => ({ ...t, connected_count: counts.get(t.slug) ?? 0, allowed: this.serviceAllowed(settings, t.slug) })),
            next_cursor: res.next_cursor,
        };
    }

    private async allTools(slug: string): Promise<ComposioTool[]> {
        const key = this.redis.key(RedisKeys.composioAllToolsCache(slug));
        const cached = await this.redis.client.get(key);
        if (cached) return JSON.parse(cached);
        const tools = await this.composio.listAllTools(slug);
        await this.redis.client.set(key, JSON.stringify(tools), 'EX', ALL_TOOLS_CACHE_SECONDS);
        return tools;
    }

    /** Service details page: the service, every tool grouped into reads/writes, and this user's permission for each. */
    async serviceDetails(actor: Actor, slug: string) {
        const [toolkit, tools, connected, settings, perms] = await Promise.all([
            this.composio.getToolkit(slug),
            this.allTools(slug),
            this.prisma.connection.count({ where: { service_key: slug, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } }),
            this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } }),
            this.prisma.userToolPermission.findMany({ where: { user_id: actor.user_id, organization_id: actor.organization_id, service_key: slug } }),
        ]);
        const permission = new Map(perms.map((p) => [p.tool_slug, p.permission]));
        return {
            toolkit: { ...toolkit, connected_count: connected, allowed: this.serviceAllowed(settings, toolkit.slug) },
            tools: tools.map((t) => {
                const action = classifyToolSlug(t.slug, {});
                return {
                    slug: t.slug,
                    name: t.name,
                    description: t.description,
                    group: action ? ToolGroups.WRITE : ToolGroups.READ,
                    action_type: action,
                    permission: permission.get(t.slug) ?? ToolPermissions.AUTO_REVIEW,
                };
            }),
        };
    }

    /** AUTO_REVIEW is the default, so it is stored as "no row". */
    async setToolPermissions(actor: Actor, slug: string, dto: SetToolPermissionsDto) {
        // Permissions belong to a connected service: nothing to protect until the user has an account for it.
        const connected = await this.prisma.connection.count({ where: { service_key: slug, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } });
        if (!connected) throw new BadRequestException('Connect this service before changing its tool permissions');
        const known = new Set((await this.allTools(slug)).map((t) => t.slug));
        const slugs = [...new Set(dto.tool_slugs)];
        const unknown = slugs.filter((t) => !known.has(t));
        if (unknown.length) throw new BadRequestException(`Unknown tool: ${unknown[0]}`);
        const where = { user_id: actor.user_id, organization_id: actor.organization_id, service_key: slug, tool_slug: { in: slugs } };
        await this.prisma.$transaction(async (tx) => {
            await tx.userToolPermission.deleteMany({ where });
            if (dto.permission !== ToolPermissions.AUTO_REVIEW) {
                await tx.userToolPermission.createMany({ data: slugs.map((tool_slug) => ({ user_id: actor.user_id, organization_id: actor.organization_id, service_key: slug, tool_slug, permission: dto.permission })) });
            }
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'connection.tool_permissions_updated', target_type: 'service', target_id: slug, metadata: { permission: dto.permission, tools: slugs.length } });
        return { ok: true };
    }

    categories() {
        return this.composio.listCategories();
    }

    /** §13.4 "Services members may connect". */
    private serviceAllowed(settings: { service_policy: string; service_list: string[] } | null, slug: string) {
        if (!settings || settings.service_policy === 'ALL') return true;
        if (settings.service_policy === 'APPROVED_LIST') return settings.service_list.includes(slug);
        return !settings.service_list.includes(slug);
    }

    async list(actor: Actor) {
        const rows = await this.prisma.connection.findMany({
            where: this.access.usableConnectionsWhere(actor.organization_id, actor.user_id),
            include: CONN_INCLUDE,
            orderBy: [{ service_name: 'asc' }, { created_at: 'asc' }],
        });
        const defaults = await this.prisma.userServiceDefault.findMany({ where: { user_id: actor.user_id, organization_id: actor.organization_id } });
        return rows.map((c) => ({
            id: c.id,
            kind: c.kind,
            service_key: c.service_key,
            service_name: c.service_name,
            label: c.label,
            account_identifier: c.account_identifier,
            visibility: c.visibility,
            status: c.status,
            status_message: c.status_message,
            owner: c.owner,
            restricted_bots: c.restricted_to_bots ? c.bot_restrictions.map((r) => r.bot) : [],
            masked_hint: c.credential?.masked_hint ?? null,
            credential_id: c.credential?.id ?? null,
            is_default: defaults.some((d) => d.connection_id === c.id),
            last_used_at: c.last_used_at,
            created_at: c.created_at,
            can_manage: c.owner_id === actor.user_id || (c.visibility === 'SHARED' && isAdminRole(actor.role)),
        }));
    }

    private callbackUrl(connectionId: string, returnUrl?: string) {
        const app = (this.config.get<string>('APP_URL') || '').replace(/\/$/, '');
        const base = returnUrl && /^(https?:\/\/|agentspace:\/\/)/.test(returnUrl) ? returnUrl : this.config.get<string>('COMPOSIO_CALLBACK_URL') || `${app}/connections/callback`;
        const u = new URL(base);
        u.searchParams.set('connection', connectionId);
        return u.toString();
    }

    /** Starts the service's normal sign-in screen (§8.1). Several accounts per service are allowed (§8.2). */
    async connectComposio(actor: Actor, dto: ConnectComposioDto) {
        const shared = dto.visibility === 'SHARED';
        if (shared && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can add shared connections');
        const settings = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        if (!this.serviceAllowed(settings, dto.toolkit)) throw new ForbiddenException('Your organisation does not allow connecting this service');
        const toolkit = await this.composio.getToolkit(dto.toolkit);
        const authConfigId = await this.composio.ensureAuthConfig(toolkit.slug);
        const existing = await this.prisma.connection.count({ where: { organization_id: actor.organization_id, service_key: toolkit.slug, owner_id: actor.user_id, deleted_at: null } });
        const conn = await this.prisma.connection.create({
            data: {
                organization_id: actor.organization_id,
                owner_id: actor.user_id,
                kind: 'COMPOSIO',
                service_key: toolkit.slug,
                service_name: toolkit.name,
                label: dto.label?.trim() || `${toolkit.name}${existing ? ` ${existing + 1}` : ''}`,
                visibility: shared ? 'SHARED' : 'PRIVATE',
                status: 'NEEDS_RECONNECTING',
                status_message: 'Waiting for sign-in',
                composio_auth_config_id: authConfigId,
            },
        });
        try {
            const composioUserId = this.composio.userId(actor.organization_id, shared ? 'org' : actor.user_id);
            const init = await this.composio.initiateConnection(authConfigId, composioUserId, this.callbackUrl(conn.id, dto.return_url));
            await this.prisma.connection.update({ where: { id: conn.id }, data: { composio_connected_account_id: init.connected_account_id, composio_user_id: composioUserId } });
            if (!init.redirect_url) {
                return this.complete(actor, conn.id);
            }
            return { connection_id: conn.id, redirect_url: init.redirect_url };
        } catch (e) {
            await this.prisma.connection.delete({ where: { id: conn.id } });
            throw e;
        }
    }

    private async requireOwnConnection(actor: Actor, id: string) {
        const c = await this.prisma.connection.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null } });
        if (!c) throw new NotFoundException('Connection not found');
        const ok = c.owner_id === actor.user_id || (c.visibility === 'SHARED' && isAdminRole(actor.role));
        if (!ok) throw new ForbiddenException('You cannot change this connection');
        return c;
    }

    /** Called from /connections/callback after sign-in: syncs status and account email from Composio. */
    async complete(actor: Actor, id: string) {
        const c = await this.requireOwnConnection(actor, id);
        if (!c.composio_connected_account_id) throw new BadRequestException('This connection has no sign-in in progress');
        const acc = await this.composio.getConnectedAccount(c.composio_connected_account_id);
        const status = acc.status === 'ACTIVE' ? 'ACTIVE' : acc.status === 'FAILED' ? 'ERROR' : 'NEEDS_RECONNECTING';
        const updated = await this.prisma.connection.update({
            where: { id },
            data: {
                status,
                status_message: status === 'ACTIVE' ? null : acc.status === 'INITIATED' ? 'Waiting for sign-in' : `Sign-in ${acc.status.toLowerCase()}`,
                account_identifier: acc.account_identifier ?? c.account_identifier,
                composio_user_id: acc.user_id ?? c.composio_user_id,
                last_synced_at: new Date(),
            },
        });
        if (status === 'ACTIVE' && c.status !== 'ACTIVE') {
            await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'connection.created', target_type: 'connection', target_id: id, connection_id: id, metadata: { service: c.service_key, visibility: c.visibility } });
            await this.events.toUser(actor.user_id, UserEvents.CONNECTION_STATUS, { connection_id: id, status });
        }
        return { connection_id: id, service_key: updated.service_key, status: updated.status, label: updated.label, account_identifier: updated.account_identifier };
    }

    async reconnect(actor: Actor, id: string, returnUrl?: string) {
        const c = await this.requireOwnConnection(actor, id);
        if (c.kind !== 'COMPOSIO') throw new BadRequestException('Replace the key on the Secrets page instead');
        const authConfigId = c.composio_auth_config_id ?? (await this.composio.ensureAuthConfig(c.service_key));
        const old = c.composio_connected_account_id;
        const composioUserId = this.composio.userId(actor.organization_id, c.visibility === 'SHARED' ? 'org' : (c.owner_id ?? actor.user_id));
        const init = await this.composio.initiateConnection(authConfigId, composioUserId, this.callbackUrl(c.id, returnUrl));
        await this.prisma.connection.update({ where: { id }, data: { composio_connected_account_id: init.connected_account_id, composio_user_id: composioUserId, status: 'NEEDS_RECONNECTING', status_message: 'Waiting for sign-in' } });
        if (old && old !== init.connected_account_id) await this.composio.deleteConnectedAccount(old).catch(() => undefined);
        return { connection_id: id, redirect_url: init.redirect_url };
    }

    async update(actor: Actor, id: string, dto: UpdateConnectionDto) {
        const c = await this.requireOwnConnection(actor, id);
        if (dto.visibility && dto.visibility !== c.visibility && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can share connections');
        if (dto.restricted_bot_ids?.length) {
            const n = await this.prisma.bot.count({ where: { organization_id: actor.organization_id, id: { in: dto.restricted_bot_ids }, deleted_at: null } });
            if (n !== new Set(dto.restricted_bot_ids).size) throw new BadRequestException('Unknown bot');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.connection.update({
                where: { id },
                data: { label: dto.label?.trim(), visibility: dto.visibility, restricted_to_bots: dto.restricted_bot_ids ? dto.restricted_bot_ids.length > 0 : undefined },
            });
            if (dto.restricted_bot_ids) {
                await tx.connectionBotRestriction.deleteMany({ where: { connection_id: id } });
                if (dto.restricted_bot_ids.length) await tx.connectionBotRestriction.createMany({ data: dto.restricted_bot_ids.map((bot_id) => ({ connection_id: id, bot_id })) });
            }
            if (c.credential_id && (dto.label || dto.visibility)) await tx.credential.update({ where: { id: c.credential_id }, data: { label: dto.label?.trim(), visibility: dto.visibility } });
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'connection.updated', target_type: 'connection', target_id: id, connection_id: id, metadata: { fields: Object.keys(dto) } });
        return (await this.list(actor)).find((x) => x.id === id);
    }

    async remove(actor: Actor, id: string) {
        const c = await this.requireOwnConnection(actor, id);
        if (c.kind === 'COMPOSIO' && c.composio_connected_account_id) {
            await this.composio.deleteConnectedAccount(c.composio_connected_account_id).catch((e) => this.logger.warn(`Composio delete failed: ${e.message}`));
        }
        if (c.credential_id) await this.credentials.remove(actor, c.credential_id).catch(() => undefined);
        await this.prisma.$transaction([
            this.prisma.connection.update({ where: { id }, data: { deleted_at: new Date(), composio_connected_account_id: null, status: 'ERROR', status_message: 'Disconnected' } }),
            this.prisma.botConnection.deleteMany({ where: { connection_id: id } }),
            this.prisma.userServiceDefault.deleteMany({ where: { connection_id: id } }),
        ]);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'connection.removed', target_type: 'connection', target_id: id, metadata: { service: c.service_key, label: c.label } });
        return { ok: true };
    }

    async createApiKey(actor: Actor, dto: CreateApiKeyConnectionDto) {
        const cred = await this.credentials.create(actor, { label: dto.label, service_name: dto.service_name, kind: 'api_key', value: dto.api_key, visibility: dto.visibility, bot_ids: dto.bot_ids });
        return (await this.list(actor)).find((c) => c.id === cred.connection_id);
    }

    async setDefault(actor: Actor, serviceKey: string, connectionId: string) {
        const c = await this.prisma.connection.findFirst({ where: { id: connectionId, service_key: serviceKey, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } });
        if (!c) throw new NotFoundException('Connection not found');
        await this.prisma.userServiceDefault.upsert({
            where: { user_id_organization_id_service_key: { user_id: actor.user_id, organization_id: actor.organization_id, service_key: serviceKey } },
            create: { user_id: actor.user_id, organization_id: actor.organization_id, service_key: serviceKey, connection_id: connectionId },
            update: { connection_id: connectionId },
        });
        return { ok: true };
    }

    /** §14.4 connections.sync-composio-status: an EXPIRED Composio connection becomes "Needs re-connecting". */
    async syncComposioStatuses() {
        const rows = await this.prisma.connection.findMany({ where: { kind: 'COMPOSIO', deleted_at: null, composio_connected_account_id: { not: null }, status: { in: ['ACTIVE', 'NEEDS_RECONNECTING'] } }, take: 500 });
        let changed = 0;
        for (const c of rows) {
            try {
                const acc = await this.composio.getConnectedAccount(c.composio_connected_account_id!);
                const status = acc.status === 'ACTIVE' ? 'ACTIVE' : acc.status === 'INITIATED' ? c.status : 'NEEDS_RECONNECTING';
                if (status !== c.status) {
                    changed++;
                    await this.prisma.connection.update({ where: { id: c.id }, data: { status, status_message: status === 'ACTIVE' ? null : 'Sign-in expired', last_synced_at: new Date() } });
                    if (status === 'NEEDS_RECONNECTING' && c.owner_id) await this.events.toUser(c.owner_id, UserEvents.CONNECTION_STATUS, { connection_id: c.id, status });
                } else {
                    await this.prisma.connection.update({ where: { id: c.id }, data: { last_synced_at: new Date(), ...(acc.user_id && acc.user_id !== c.composio_user_id ? { composio_user_id: acc.user_id } : {}) } });
                }
            } catch (e) {
                this.logger.warn(`Status sync failed for ${c.id}: ${(e as Error).message}`);
            }
        }
        return { checked: rows.length, changed };
    }

    /** §8.7 Member removal: delete their private connections and keys in that organisation (and revoke at the provider). */
    async revokeAndDeleteForMember(orgId: string, userId: string) {
        const conns = await this.prisma.connection.findMany({ where: { organization_id: orgId, owner_id: userId, visibility: 'PRIVATE', deleted_at: null } });
        for (const c of conns) {
            if (c.composio_connected_account_id) await this.composio.deleteConnectedAccount(c.composio_connected_account_id);
            await this.prisma.connection.update({ where: { id: c.id }, data: { deleted_at: new Date(), composio_connected_account_id: null } });
        }
        const creds = await this.prisma.credential.findMany({ where: { organization_id: orgId, owner_id: userId, visibility: 'PRIVATE', deleted_at: null } });
        for (const cred of creds) {
            await this.store.delete(cred.secret_resource_name);
            await this.prisma.credential.update({ where: { id: cred.id }, data: { deleted_at: new Date() } });
            await this.prisma.credentialEvent.create({ data: { credential_id: cred.id, type: 'DELETED', metadata: { reason: 'member_removed' } } });
        }
        return { connections: conns.length, credentials: creds.length };
    }
}
