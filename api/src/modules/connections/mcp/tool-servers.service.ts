import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ComposioService, CustomAuthMode, CustomAuthModes } from '@/integrations/composio/composio.service';
import { newId } from '@/shared/utils/security/crypto.utils';
import { AccessService, isAdminRole } from '../../access/access.service';
import { ActivityService } from '../../activity/activity.service';
import { assertPublicUrl } from '../../agent/tools/web.utils';
import type { Actor } from '../../bots/bots.service';
import { ConnectionsService } from '../connections.service';
import { discoverOAuthMetadataUrl, OAuthDiscoveryError } from './oauth-discovery';
import { CreateToolServerDto, ToolServerAuthKind, ToolServerAuthKinds, UpdateToolServerDto } from './tool-server.dto';

/** Our sign-in types and Composio's custom MCP auth modes. */
const COMPOSIO_MODE: Record<ToolServerAuthKind, CustomAuthMode> = {
    [ToolServerAuthKinds.NONE]: CustomAuthModes.NO_AUTH,
    [ToolServerAuthKinds.TOKEN]: CustomAuthModes.API_KEY,
    [ToolServerAuthKinds.OAUTH]: CustomAuthModes.DCR_OAUTH,
};
const MODE_LABEL: Record<CustomAuthMode, string> = {
    [CustomAuthModes.NO_AUTH]: '"No sign-in"',
    [CustomAuthModes.API_KEY]: '"Access token"',
    [CustomAuthModes.DCR_OAUTH]: '"Sign in"',
};

const LEGACY_MESSAGE = 'Remove this tool server and add it again to reconnect it.';

const INCLUDE = {
    owner: { select: { id: true, name: true, email: true } },
    connection: {
        include: { bot_restrictions: { include: { bot: { select: { id: true, name: true, emoji: true, color: true } } } } },
    },
} satisfies Prisma.ToolServerInclude;

type ServerRow = Prisma.ToolServerGetPayload<{ include: typeof INCLUDE }>;
type ConnectionRow = NonNullable<ServerRow['connection']>;

/**
 * Custom tool servers (§8.4): MCP servers users add by address, with no sign-in, an access token, or the server's own
 * sign-in screen. Each server is registered with Composio as a shared custom toolkit and each user's sign-in is a
 * Composio connected account, so tool calls, token refresh, status sync and per-tool permissions work exactly like the
 * other connected services. Agent Space never holds the server's tokens.
 */
@Injectable()
export class ToolServersService {
    private readonly logger = new Logger(ToolServersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly composio: ComposioService,
        private readonly connections: ConnectionsService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
    ) { }

    // ---------------- Shapes and permissions ----------------

    private shape(s: ServerRow, actor: Actor) {
        const c = s.connection;
        return {
            id: s.id,
            name: s.name,
            url: s.url,
            auth_kind: s.auth_kind,
            visibility: s.visibility,
            status: c?.status ?? 'ERROR',
            status_message: s.composio_toolkit_slug ? (c?.status_message ?? null) : LEGACY_MESSAGE,
            tool_count: s.tool_count,
            last_listed_at: s.last_listed_at,
            service_key: s.composio_toolkit_slug,
            owner: s.owner,
            bots: c?.restricted_to_bots ? c.bot_restrictions.map((b) => b.bot) : [],
            connection_id: c?.id ?? null,
            created_at: s.created_at,
            can_manage: this.canManage(s, actor),
        };
    }

    private canManage(s: { owner_id: string | null; visibility: string }, actor: Actor) {
        return s.owner_id === actor.user_id || (s.visibility === 'SHARED' && isAdminRole(actor.role));
    }

    /** Tool servers a user can see: their own private ones and every shared one (§8.4, §11 privacy). */
    private usableWhere(orgId: string, userId: string): Prisma.ToolServerWhereInput {
        return { organization_id: orgId, deleted_at: null, OR: [{ owner_id: userId }, { visibility: 'SHARED' }] };
    }

    private async find(actor: Actor, id: string) {
        const s = await this.prisma.toolServer.findFirst({ where: { id, ...this.usableWhere(actor.organization_id, actor.user_id) }, include: INCLUDE });
        if (!s) throw new NotFoundException('Tool server not found');
        return s;
    }

    private async requireManageable(actor: Actor, id: string) {
        const s = await this.find(actor, id);
        if (!this.canManage(s, actor)) throw new ForbiddenException('Only the person who added it (or an Owner/Admin for shared servers) can change this tool server');
        return s;
    }

    /** A server added before the move to Composio has no toolkit: it can only be removed and added again. */
    private requireCurrent(s: ServerRow): asserts s is ServerRow & { composio_toolkit_slug: string; connection: ConnectionRow } {
        if (!s.composio_toolkit_slug || !s.connection) throw new BadRequestException(LEGACY_MESSAGE);
    }

    private async checkVisibility(actor: Actor, visibility: 'PRIVATE' | 'SHARED') {
        if (visibility === 'SHARED' && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can add shared tool servers');
        if (visibility === 'PRIVATE' && !isAdminRole(actor.role)) {
            const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
            if (s && s.members_private_tool_servers === false) throw new ForbiddenException('Members cannot add their own tool servers in this organisation');
        }
    }

    private async checkBots(actor: Actor, botIds: string[] | undefined, shared: boolean) {
        if (!botIds?.length) return;
        const where = shared && isAdminRole(actor.role) ? { organization_id: actor.organization_id, deleted_at: null } : this.access.usableBotsWhere(actor.organization_id, actor.user_id);
        const n = await this.prisma.bot.count({ where: { ...where, id: { in: botIds } } });
        if (n !== new Set(botIds).size) throw new BadRequestException('Unknown bot');
    }

    /** https and a public address only. Composio connects to it, so it must be reachable from the internet. */
    private async validateUrl(raw: string): Promise<URL> {
        let url: URL;
        try {
            url = new URL(raw.trim());
        } catch {
            throw new BadRequestException('Enter a valid address, e.g. https://tools.example.com/mcp');
        }
        if (url.username || url.password) throw new BadRequestException('Put credentials in the access token field, not in the address');
        if (url.protocol !== 'https:') throw new BadRequestException('Tool servers must use https');
        try {
            await assertPublicUrl(url.toString());
        } catch {
            throw new BadRequestException('That address is not allowed (private or internal network). The server must be reachable from the internet.');
        }
        return url;
    }

    private composioError(e: unknown, what: string): never {
        const detail = (e as any)?.getResponse?.()?.detail ?? (e as Error).message;
        throw new BadRequestException(`${what}: ${String(detail).slice(0, 200)}`);
    }

    // ---------------- CRUD ----------------

    async list(actor: Actor) {
        const rows = await this.prisma.toolServer.findMany({ where: this.usableWhere(actor.organization_id, actor.user_id), include: INCLUDE, orderBy: { created_at: 'asc' } });
        return rows.map((r) => this.shape(r, actor));
    }

    async get(actor: Actor, id: string) {
        return this.shape(await this.find(actor, id), actor);
    }

    async create(actor: Actor, dto: CreateToolServerDto) {
        const visibility = dto.visibility ?? 'PRIVATE';
        const shared = visibility === 'SHARED';
        await this.checkVisibility(actor, visibility);
        await this.checkBots(actor, dto.bot_ids, shared);
        const url = await this.validateUrl(dto.url);
        if (dto.auth_kind === ToolServerAuthKinds.TOKEN && !dto.token?.trim()) throw new BadRequestException('Paste the access token');
        const name = dto.name.trim();
        const dup = await this.prisma.toolServer.count({ where: { organization_id: actor.organization_id, deleted_at: null, url: url.toString(), owner_id: actor.user_id } });
        if (dup) throw new BadRequestException('You already added this tool server');

        // Register (or reuse) the server's Composio toolkit. Its sign-in type is fixed once registered.
        const mode = COMPOSIO_MODE[dto.auth_kind];
        let discoveryUrl: string | undefined;
        if (mode === CustomAuthModes.DCR_OAUTH) {
            try {
                discoveryUrl = await discoverOAuthMetadataUrl(url);
            } catch (e) {
                if (e instanceof OAuthDiscoveryError) throw new BadRequestException(e.message);
                throw e;
            }
        }
        let toolkit;
        try {
            toolkit = await this.composio.ensureCustomToolkit(url.toString(), mode, discoveryUrl);
        } catch (e) {
            this.composioError(e, 'The tool server could not be registered');
        }
        if (toolkit.auth_mode && toolkit.auth_mode !== mode) {
            throw new BadRequestException(`This server address is already set up with ${MODE_LABEL[toolkit.auth_mode]}. Choose that sign-in option instead.`);
        }

        const composioUserId = this.composio.userId(actor.organization_id, shared ? 'org' : actor.user_id);
        let authConfigId: string | null = null;
        if (mode !== CustomAuthModes.NO_AUTH) {
            try {
                authConfigId = await this.composio.ensureCustomAuthConfig(toolkit.slug, mode);
            } catch (e) {
                this.composioError(e, 'The tool server sign-in could not be set up');
            }
        }

        const id = newId();
        const restricted = !!dto.bot_ids?.length;
        const connection = await this.prisma.$transaction(async (tx) => {
            await tx.toolServer.create({ data: { id, organization_id: actor.organization_id, owner_id: actor.user_id, name, url: url.toString(), auth_kind: dto.auth_kind, visibility, composio_toolkit_slug: toolkit.slug } });
            return tx.connection.create({
                data: {
                    organization_id: actor.organization_id,
                    owner_id: actor.user_id,
                    kind: 'MCP',
                    service_key: toolkit.slug,
                    service_name: name,
                    label: name,
                    account_identifier: url.host,
                    visibility,
                    tool_server_id: id,
                    composio_auth_config_id: authConfigId,
                    composio_user_id: composioUserId,
                    status: 'NEEDS_RECONNECTING',
                    status_message: mode === CustomAuthModes.DCR_OAUTH ? 'Waiting for sign-in' : 'Connecting',
                    restricted_to_bots: restricted,
                    bot_restrictions: restricted ? { create: dto.bot_ids!.map((bot_id) => ({ bot_id })) } : undefined,
                },
            });
        });

        // Connect the user's account. Undo the rows when Composio refuses, so a failed add leaves nothing behind.
        let authorizationUrl: string | null = null;
        try {
            if (mode === CustomAuthModes.DCR_OAUTH) {
                const init = await this.composio.initiateConnection(authConfigId!, composioUserId, this.connections.callbackUrl(connection.id, dto.return_url));
                await this.prisma.connection.update({ where: { id: connection.id }, data: { composio_connected_account_id: init.connected_account_id } });
                authorizationUrl = init.redirect_url;
            } else if (mode === CustomAuthModes.API_KEY) {
                const accountId = await this.composio.connectWithApiKey(authConfigId!, composioUserId, dto.token!.trim());
                await this.prisma.connection.update({ where: { id: connection.id }, data: { composio_connected_account_id: accountId } });
            }
        } catch (e) {
            await this.prisma.$transaction([this.prisma.connection.delete({ where: { id: connection.id } }), this.prisma.toolServer.delete({ where: { id } })]);
            this.composioError(e, 'Could not connect to the tool server');
        }

        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.added', target_type: 'tool_server', target_id: id, metadata: { name, host: url.host, auth: dto.auth_kind, visibility } });
        if (authorizationUrl) return { tool_server: await this.get(actor, id), authorization_url: authorizationUrl };
        await this.refresh(id);
        return { tool_server: await this.get(actor, id), authorization_url: null };
    }

    async update(actor: Actor, id: string, dto: UpdateToolServerDto) {
        const s = await this.requireManageable(actor, id);
        const visibility = dto.visibility ?? s.visibility;
        if (dto.visibility && dto.visibility !== s.visibility) await this.checkVisibility(actor, dto.visibility);
        if (dto.bot_ids) await this.checkBots(actor, dto.bot_ids, visibility === 'SHARED');
        const name = dto.name?.trim() || undefined;
        await this.prisma.$transaction(async (tx) => {
            await tx.toolServer.update({ where: { id }, data: { name, visibility } });
            if (!s.connection) return;
            // The sign-in keeps its Composio user: a connection's stored composio_user_id is never recomputed.
            await tx.connection.update({
                where: { id: s.connection.id },
                data: { label: name, service_name: name, visibility, ...(dto.bot_ids ? { restricted_to_bots: dto.bot_ids.length > 0 } : {}) },
            });
            if (dto.bot_ids) {
                await tx.connectionBotRestriction.deleteMany({ where: { connection_id: s.connection.id } });
                if (dto.bot_ids.length) await tx.connectionBotRestriction.createMany({ data: dto.bot_ids.map((bot_id) => ({ bot_id, connection_id: s.connection!.id })) });
            }
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.updated', target_type: 'tool_server', target_id: id, metadata: { ...dto } });
        return this.get(actor, id);
    }

    /** Replace the access token (TOKEN servers): a new Composio account replaces the old one. */
    async setToken(actor: Actor, id: string, token: string) {
        const s = await this.requireManageable(actor, id);
        this.requireCurrent(s);
        if (s.auth_kind !== ToolServerAuthKinds.TOKEN) throw new BadRequestException('This tool server does not use an access token');
        const c = s.connection;
        let accountId: string;
        try {
            const authConfigId = c.composio_auth_config_id ?? (await this.composio.ensureCustomAuthConfig(s.composio_toolkit_slug, CustomAuthModes.API_KEY));
            accountId = await this.composio.connectWithApiKey(authConfigId, c.composio_user_id!, token.trim());
            await this.prisma.connection.update({ where: { id: c.id }, data: { composio_connected_account_id: accountId, composio_auth_config_id: authConfigId } });
        } catch (e) {
            this.composioError(e, 'Could not save the new token');
        }
        if (c.composio_connected_account_id && c.composio_connected_account_id !== accountId) {
            await this.composio.deleteConnectedAccount(c.composio_connected_account_id).catch((e) => this.logger.warn(`Old account delete failed: ${(e as Error).message}`));
        }
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.token_replaced', target_type: 'tool_server', target_id: id, metadata: { name: s.name } });
        await this.refresh(id);
        return this.get(actor, id);
    }

    /** Start (or redo) the server's own sign-in through Composio's hosted sign-in screen. */
    async startSignIn(actor: Actor, id: string, returnUrl?: string) {
        const s = await this.requireManageable(actor, id);
        this.requireCurrent(s);
        if (s.auth_kind !== ToolServerAuthKinds.OAUTH) throw new BadRequestException('This tool server does not use sign-in');
        try {
            const r = await this.connections.reconnect(actor, s.connection.id, returnUrl);
            return { authorization_url: r.redirect_url };
        } catch (e) {
            this.composioError(e, 'The sign-in could not be started');
        }
    }

    async remove(actor: Actor, id: string) {
        const s = await this.requireManageable(actor, id);
        // Removes this user's Composio account and both rows. The shared Composio toolkit stays (see ensureCustomToolkit).
        if (s.connection) await this.connections.remove(actor, s.connection.id);
        else await this.prisma.toolServer.update({ where: { id }, data: { deleted_at: new Date() } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.removed', target_type: 'tool_server', target_id: id, metadata: { name: s.name } });
        return { ok: true };
    }

    /** "Test connection": re-reads the server's tools through Composio and updates the status. */
    async test(actor: Actor, id: string) {
        const s = await this.find(actor, id);
        this.requireCurrent(s);
        const result = await this.refresh(id);
        return { ...result, tool_server: await this.get(actor, id) };
    }

    /** Checks the sign-in, re-reads the tool list and records the outcome on the connection. Never throws. */
    private async refresh(id: string): Promise<{ ok: boolean; tool_count: number; tools: { name: string; description?: string }[]; error?: string }> {
        const s = await this.prisma.toolServer.findUnique({ where: { id }, include: INCLUDE });
        if (!s?.composio_toolkit_slug || !s.connection) return { ok: false, tool_count: 0, tools: [], error: LEGACY_MESSAGE };
        const c = s.connection;
        const fail = async (status: 'ERROR' | 'NEEDS_RECONNECTING', error: string) => {
            await this.prisma.connection.update({ where: { id: c.id }, data: { status, status_message: error.slice(0, 300) } });
            return { ok: false, tool_count: 0, tools: [], error };
        };
        if (s.auth_kind !== ToolServerAuthKinds.NONE) {
            if (!c.composio_connected_account_id) return fail('NEEDS_RECONNECTING', s.auth_kind === ToolServerAuthKinds.OAUTH ? 'Sign in to finish adding this tool server' : 'Add the access token for this tool server');
            try {
                const acc = await this.composio.getConnectedAccount(c.composio_connected_account_id);
                if (acc.status !== 'ACTIVE') return fail('NEEDS_RECONNECTING', acc.status === 'INITIATED' ? 'Waiting for sign-in' : s.auth_kind === ToolServerAuthKinds.OAUTH ? 'Sign-in expired. Sign in again.' : 'The access token was rejected. Replace it.');
            } catch (e) {
                return fail('ERROR', `Couldn't check the sign-in: ${(e as Error).message}`);
            }
        }
        try {
            const tools = await this.connections.syncToolServerTools(c);
            await this.prisma.connection.update({ where: { id: c.id }, data: { status: 'ACTIVE', status_message: tools.length ? null : 'Connected, but the server offers no tools', last_synced_at: new Date() } });
            return { ok: true, tool_count: tools.length, tools: tools.map((t) => ({ name: t.name, description: t.description?.slice(0, 200) })) };
        } catch (e) {
            const detail = (e as any)?.getResponse?.()?.detail ?? (e as Error).message;
            return fail('ERROR', `Couldn't load the server's tools: ${String(detail)}`);
        }
    }
}
