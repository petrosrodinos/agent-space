import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService, UserEvents } from '@/core/realtime/events.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { ComposioService, ComposioTool, isCustomToolkit } from '@/integrations/composio/composio.service';
import { SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { AccessService, isAdminRole } from '../access/access.service';
import { classifyServiceTool } from '../agent/approval-policy';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { CredentialsService } from './credentials.service';
import { CatalogQuery, ConnectComposioDto, CreateApiKeyConnectionDto, SetToolPermissionsDto, ToolPermissions, UpdateConnectionDto } from './dto/connection.dto';

const CONN_INCLUDE = {
    owner: { select: { id: true, name: true, email: true } },
    bot_restrictions: { include: { bot: { select: { id: true, name: true, emoji: true, color: true } } } },
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
        const custom = isCustomToolkit(slug);
        const [toolkit, tools, connected, settings, perms, server] = await Promise.all([
            this.composio.getToolkit(slug),
            this.allTools(slug),
            this.prisma.connection.count({ where: { service_key: slug, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } }),
            this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } }),
            this.prisma.userToolPermission.findMany({ where: { user_id: actor.user_id, organization_id: actor.organization_id, service_key: slug } }),
            // A custom toolkit is shared across the Composio project: show this organisation's name for it, not Composio's.
            custom ? this.prisma.connection.findFirst({ where: { service_key: slug, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) }, select: { service_name: true } }) : null,
        ]);
        const permission = new Map(perms.map((p) => [p.tool_slug, p.permission]));
        return {
            toolkit: {
                ...toolkit,
                ...(custom ? { slug, name: server?.service_name ?? toolkit.name, description: null, website: null } : {}),
                // Custom tool servers are added and removed from the "Custom tool servers" section, not from this page.
                is_tool_server: custom,
                connected_count: connected,
                allowed: custom || this.serviceAllowed(settings, toolkit.slug),
            },
            tools: tools.map((t) => {
                const action = classifyServiceTool(t, {});
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

    /** Where a hosted sign-in returns to: /connections/callback?connection=<id> (or the app's own return address). */
    callbackUrl(connectionId: string, returnUrl?: string) {
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
        let status: 'ACTIVE' | 'ERROR' | 'NEEDS_RECONNECTING' = acc.status === 'ACTIVE' ? 'ACTIVE' : acc.status === 'FAILED' ? 'ERROR' : 'NEEDS_RECONNECTING';
        let message: string | null = status === 'ACTIVE' ? null : acc.status === 'INITIATED' ? 'Waiting for sign-in' : `Sign-in ${acc.status.toLowerCase()}`;
        // A custom tool server's tools are read once its first account is signed in (§8.4).
        if (status === 'ACTIVE' && c.kind === 'MCP' && c.status !== 'ACTIVE') {
            try {
                await this.syncToolServerTools(c);
            } catch (e) {
                status = 'ERROR';
                message = `Signed in, but its tools couldn't be loaded: ${(e as Error).message.slice(0, 200)}`;
            }
        }
        // The tool server's host stays the visible identifier: custom servers don't report an account email.
        const identifier = c.kind === 'MCP' ? c.account_identifier : (acc.account_identifier ?? c.account_identifier);
        const updated = await this.prisma.connection.update({
            where: { id },
            data: { status, status_message: message, account_identifier: identifier, composio_user_id: acc.user_id ?? c.composio_user_id, last_synced_at: new Date() },
        });
        if (status === 'ACTIVE' && c.status !== 'ACTIVE') {
            await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'connection.created', target_type: 'connection', target_id: id, connection_id: id, metadata: { service: c.service_key, visibility: c.visibility } });
            await this.events.toUser(actor.user_id, UserEvents.CONNECTION_STATUS, { connection_id: id, status });
        }
        return { connection_id: id, service_key: updated.service_key, status: updated.status, label: updated.label, account_identifier: updated.account_identifier };
    }

    async reconnect(actor: Actor, id: string, returnUrl?: string) {
        const c = await this.requireOwnConnection(actor, id);
        // Custom tool servers with a sign-in carry their toolkit's auth config; access-token ones replace the token instead.
        const signInServer = c.kind === 'MCP' && !!c.composio_auth_config_id && isCustomToolkit(c.service_key);
        if (c.kind !== 'COMPOSIO' && !signInServer) throw new BadRequestException(c.kind === 'MCP' ? 'This tool server has no sign-in to redo' : 'Replace the key on the Secrets page instead');
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
        // Composio services and custom tool servers alike: only this account is removed, never a shared custom toolkit.
        if (c.composio_connected_account_id) {
            await this.composio.deleteConnectedAccount(c.composio_connected_account_id).catch((e) => this.logger.warn(`Composio delete failed: ${e.message}`));
        }
        // Tool servers added before the move to Composio may still point to their own stored token.
        if (c.credential_id) await this.credentials.remove(actor, c.credential_id).catch(() => undefined);
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.connection.update({ where: { id }, data: { deleted_at: now, composio_connected_account_id: null, status: 'ERROR', status_message: 'Disconnected' } }),
            this.prisma.botConnection.deleteMany({ where: { connection_id: id } }),
            this.prisma.userServiceDefault.deleteMany({ where: { connection_id: id } }),
            ...(c.tool_server_id ? [this.prisma.toolServer.update({ where: { id: c.tool_server_id }, data: { deleted_at: now } })] : []),
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
        // Custom tool servers (MCP) with a sign-in are Composio connected accounts too: Composio refreshes their tokens.
        const rows = await this.prisma.connection.findMany({ where: { kind: { in: ['COMPOSIO', 'MCP'] }, deleted_at: null, composio_connected_account_id: { not: null }, status: { in: ['ACTIVE', 'NEEDS_RECONNECTING'] } }, take: 500 });
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

    /**
     * Custom tool servers (§8.4): asks Composio to re-read the server's tools, records the count and clears the tool
     * caches so bots see the change right away. Throws when the server can't be reached.
     */
    async syncToolServerTools(c: { service_key: string; composio_connected_account_id: string | null; tool_server_id: string | null }) {
        await this.composio.syncCustomToolkit(c.service_key, c.composio_connected_account_id);
        await this.redis.client.del(this.redis.key(RedisKeys.composioToolsCache(c.service_key)), this.redis.key(RedisKeys.composioAllToolsCache(c.service_key)));
        const tools = await this.composio.listAllTools(c.service_key);
        if (c.tool_server_id) await this.prisma.toolServer.update({ where: { id: c.tool_server_id }, data: { tool_count: tools.length, last_listed_at: new Date() } });
        return tools;
    }

    /** §8.7 Member removal: delete their private connections and keys in that organisation (and revoke at the provider). */
    async revokeAndDeleteForMember(orgId: string, userId: string) {
        const conns = await this.prisma.connection.findMany({ where: { organization_id: orgId, owner_id: userId, visibility: 'PRIVATE', deleted_at: null } });
        for (const c of conns) {
            if (c.composio_connected_account_id) await this.composio.deleteConnectedAccount(c.composio_connected_account_id);
            await this.prisma.connection.update({ where: { id: c.id }, data: { deleted_at: new Date(), composio_connected_account_id: null } });
            if (c.tool_server_id) await this.prisma.toolServer.update({ where: { id: c.tool_server_id }, data: { deleted_at: new Date() } });
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
