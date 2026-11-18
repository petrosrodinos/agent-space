import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { Prisma, ToolServer } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { maskSecret } from '@/shared/utils/security/secret-detection.utils';
import { newId, randomToken, slugify } from '@/shared/utils/security/crypto.utils';
import { AccessService, isAdminRole } from '../../access/access.service';
import { ActivityService } from '../../activity/activity.service';
import type { Actor } from '../../bots/bots.service';
import { CredentialsService } from '../credentials.service';
import { McpAuth, McpAuthError, McpClientService, McpToolInfo } from './mcp-client.service';
import { McpOAuthData, McpOAuthProvider } from './mcp-oauth.provider';
import type { CreateToolServerDto, UpdateToolServerDto } from './tool-server.dto';

const TOOLS_CACHE_SECONDS = 300;
const SIGN_IN_TTL_SECONDS = 15 * 60;

const INCLUDE = {
    owner: { select: { id: true, name: true, email: true } },
    credential: { select: { id: true, masked_hint: true, kind: true, status: true } },
    bots: { include: { bot: { select: { id: true, name: true, emoji: true, color: true } } } },
    connection: { select: { id: true } },
} satisfies Prisma.ToolServerInclude;

type ServerRow = Prisma.ToolServerGetPayload<{ include: typeof INCLUDE }>;

interface PendingSignIn {
    tool_server_id: string;
    user_id: string;
    organization_id: string;
    data: McpOAuthData;
}

/**
 * Custom tool servers (§8.4): MCP servers users add by address, with no sign-in, an access token, or the server's own
 * sign-in screen (standard MCP OAuth). Tokens live only in the secret store (§8.7) and are never returned to clients.
 */
@Injectable()
export class ToolServersService {
    private readonly logger = new Logger(ToolServersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly store: SecretStoreService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly credentials: CredentialsService,
        private readonly mcp: McpClientService,
        private readonly config: ConfigService,
    ) { }

    // ---------------- Shapes and permissions ----------------

    private shape(s: ServerRow, actor: Actor) {
        return {
            id: s.id,
            name: s.name,
            url: s.url,
            auth_kind: s.auth_kind,
            visibility: s.visibility,
            status: s.status,
            status_message: s.status_message,
            tool_count: s.tool_count,
            last_listed_at: s.last_listed_at,
            masked_hint: s.auth_kind === 'TOKEN' ? (s.credential?.masked_hint ?? null) : null,
            signed_in: s.auth_kind === 'OAUTH' ? !!s.credential : undefined,
            owner: s.owner,
            bots: s.bots.map((b) => b.bot),
            connection_id: s.connection?.id ?? null,
            created_at: s.created_at,
            can_manage: this.canManage(s, actor),
        };
    }

    private canManage(s: { owner_id: string | null; visibility: string }, actor: Actor) {
        return s.owner_id === actor.user_id || (s.visibility === 'SHARED' && isAdminRole(actor.role));
    }

    /** Tool servers a user can see and use: their own private ones and every shared one (§8.4, §11 privacy). */
    usableWhere(orgId: string, userId: string): Prisma.ToolServerWhereInput {
        return { organization_id: orgId, deleted_at: null, OR: [{ owner_id: userId }, { visibility: 'SHARED' }] };
    }

    private async requireManageable(actor: Actor, id: string) {
        const s = await this.prisma.toolServer.findFirst({ where: { id, ...this.usableWhere(actor.organization_id, actor.user_id) }, include: INCLUDE });
        if (!s) throw new NotFoundException('Tool server not found');
        if (!this.canManage(s, actor)) throw new ForbiddenException('Only the person who added it (or an Owner/Admin for shared servers) can change this tool server');
        return s;
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

    private redirectUrl() {
        const app = (this.config.get<string>('APP_URL') || '').replace(/\/$/, '');
        return `${app}/connections/mcp-callback`;
    }

    // ---------------- CRUD ----------------

    async list(actor: Actor) {
        const rows = await this.prisma.toolServer.findMany({ where: this.usableWhere(actor.organization_id, actor.user_id), include: INCLUDE, orderBy: { created_at: 'asc' } });
        return rows.map((r) => this.shape(r, actor));
    }

    async get(actor: Actor, id: string) {
        const s = await this.prisma.toolServer.findFirst({ where: { id, ...this.usableWhere(actor.organization_id, actor.user_id) }, include: INCLUDE });
        if (!s) throw new NotFoundException('Tool server not found');
        return this.shape(s, actor);
    }

    async create(actor: Actor, dto: CreateToolServerDto) {
        const visibility = dto.visibility ?? 'PRIVATE';
        await this.checkVisibility(actor, visibility);
        await this.checkBots(actor, dto.bot_ids, visibility === 'SHARED');
        let url: URL;
        try {
            url = await this.mcp.validateUrl(dto.url);
        } catch (e) {
            throw new BadRequestException((e as Error).message);
        }
        if (dto.auth_kind === 'TOKEN' && !dto.token?.trim()) throw new BadRequestException('Paste the access token');
        const name = dto.name.trim();
        const dup = await this.prisma.toolServer.count({ where: { organization_id: actor.organization_id, deleted_at: null, url: url.toString(), owner_id: actor.user_id } });
        if (dup) throw new BadRequestException('You already added this tool server');

        let credentialId: string | null = null;
        if (dto.auth_kind === 'TOKEN') {
            const cred = await this.credentials.create(actor, { label: `${name} – access token`, service_name: name, kind: 'mcp_token', value: dto.token!, visibility, bot_ids: dto.bot_ids });
            credentialId = cred.id;
        }
        const id = newId();
        await this.prisma.$transaction(async (tx) => {
            await tx.toolServer.create({
                data: {
                    id,
                    organization_id: actor.organization_id,
                    owner_id: actor.user_id,
                    name,
                    url: url.toString(),
                    auth_kind: dto.auth_kind,
                    credential_id: credentialId,
                    visibility,
                    status: dto.auth_kind === 'OAUTH' ? 'NEEDS_RECONNECTING' : 'ACTIVE',
                    status_message: dto.auth_kind === 'OAUTH' ? 'Sign in to finish adding this tool server' : null,
                    bots: dto.bot_ids?.length ? { create: dto.bot_ids.map((bot_id) => ({ bot_id })) } : undefined,
                },
            });
            await tx.connection.create({
                data: {
                    organization_id: actor.organization_id,
                    owner_id: actor.user_id,
                    kind: 'MCP',
                    service_key: `mcp-${slugify(name, 30)}`,
                    service_name: name,
                    label: name,
                    account_identifier: url.host,
                    visibility,
                    tool_server_id: id,
                    credential_id: credentialId,
                    restricted_to_bots: !!dto.bot_ids?.length,
                    bot_restrictions: dto.bot_ids?.length ? { create: dto.bot_ids.map((bot_id) => ({ bot_id })) } : undefined,
                },
            });
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.added', target_type: 'tool_server', target_id: id, metadata: { name, host: url.host, auth: dto.auth_kind, visibility } });

        if (dto.auth_kind === 'OAUTH') {
            const signIn = await this.startSignIn(actor, id);
            return { tool_server: await this.get(actor, id), ...signIn };
        }
        await this.refresh(id);
        return { tool_server: await this.get(actor, id) };
    }

    async update(actor: Actor, id: string, dto: UpdateToolServerDto) {
        const s = await this.requireManageable(actor, id);
        const visibility = dto.visibility ?? s.visibility;
        if (dto.visibility && dto.visibility !== s.visibility) await this.checkVisibility(actor, dto.visibility);
        if (dto.bot_ids) await this.checkBots(actor, dto.bot_ids, visibility === 'SHARED');
        let url: string | undefined;
        if (dto.url && dto.url !== s.url) {
            try {
                url = (await this.mcp.validateUrl(dto.url)).toString();
            } catch (e) {
                throw new BadRequestException((e as Error).message);
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.toolServer.update({ where: { id }, data: { name: dto.name?.trim() || undefined, url, visibility } });
            if (dto.bot_ids) {
                await tx.botToolServer.deleteMany({ where: { tool_server_id: id } });
                if (dto.bot_ids.length) await tx.botToolServer.createMany({ data: dto.bot_ids.map((bot_id) => ({ bot_id, tool_server_id: id })) });
            }
            if (s.connection) {
                await tx.connection.update({
                    where: { id: s.connection.id },
                    data: { label: dto.name?.trim() || undefined, service_name: dto.name?.trim() || undefined, visibility, ...(url ? { account_identifier: new URL(url).host } : {}), ...(dto.bot_ids ? { restricted_to_bots: dto.bot_ids.length > 0 } : {}) },
                });
                if (dto.bot_ids) {
                    await tx.connectionBotRestriction.deleteMany({ where: { connection_id: s.connection.id } });
                    if (dto.bot_ids.length) await tx.connectionBotRestriction.createMany({ data: dto.bot_ids.map((bot_id) => ({ bot_id, connection_id: s.connection!.id })) });
                }
            }
            if (s.credential_id && (dto.visibility || dto.name)) {
                await tx.credential.update({ where: { id: s.credential_id }, data: { visibility, owner_type: visibility === 'SHARED' ? 'ORGANIZATION' : 'USER', ...(dto.name ? { label: `${dto.name.trim()} – ${s.auth_kind === 'OAUTH' ? 'sign-in' : 'access token'}`, service_name: dto.name.trim() } : {}) } });
            }
        });
        await this.invalidateCache(id);
        if (url) await this.refresh(id);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.updated', target_type: 'tool_server', target_id: id, metadata: { ...dto, url: url ? new URL(url).host : undefined } });
        return this.get(actor, id);
    }

    /** Replace the access token (TOKEN servers). */
    async setToken(actor: Actor, id: string, token: string) {
        const s = await this.requireManageable(actor, id);
        if (s.auth_kind !== 'TOKEN') throw new BadRequestException('This tool server does not use an access token');
        if (s.credential_id) await this.credentials.replace(actor, s.credential_id, token);
        else {
            const cred = await this.credentials.create(actor, { label: `${s.name} – access token`, service_name: s.name, kind: 'mcp_token', value: token, visibility: s.visibility });
            await this.prisma.toolServer.update({ where: { id }, data: { credential_id: cred.id } });
            if (s.connection) await this.prisma.connection.update({ where: { id: s.connection.id }, data: { credential_id: cred.id } });
        }
        await this.invalidateCache(id);
        await this.refresh(id);
        return this.get(actor, id);
    }

    async remove(actor: Actor, id: string) {
        const s = await this.requireManageable(actor, id);
        const now = new Date();
        if (s.credential_id) {
            const cred = await this.prisma.credential.findUnique({ where: { id: s.credential_id } });
            if (cred && !cred.deleted_at) {
                await this.store.delete(cred.secret_resource_name).catch((e) => this.logger.warn(`Secret delete failed: ${(e as Error).message}`));
                await this.prisma.credential.update({ where: { id: cred.id }, data: { deleted_at: now } });
            }
        }
        await this.prisma.$transaction([
            this.prisma.toolServer.update({ where: { id }, data: { deleted_at: now } }),
            this.prisma.connection.updateMany({ where: { tool_server_id: id }, data: { deleted_at: now } }),
            this.prisma.botToolServer.deleteMany({ where: { tool_server_id: id } }),
        ]);
        await this.invalidateCache(id);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.removed', target_type: 'tool_server', target_id: id, metadata: { name: s.name } });
        return { ok: true };
    }

    /** "Test connection": reconnects, lists tools and updates the status. */
    async test(actor: Actor, id: string) {
        await this.get(actor, id);
        await this.invalidateCache(id);
        const result = await this.refresh(id);
        return { ...result, tool_server: await this.get(actor, id) };
    }

    // ---------------- Standard MCP sign-in (OAuth) ----------------

    async startSignIn(actor: Actor, id: string) {
        const s = await this.requireManageable(actor, id);
        if (s.auth_kind !== 'OAUTH') throw new BadRequestException('This tool server does not use sign-in');
        const existing = s.credential_id ? await this.loadOAuth(s.credential_id).catch(() => null) : null;
        const state = randomToken(24);
        const pending: PendingSignIn = { tool_server_id: id, user_id: actor.user_id, organization_id: actor.organization_id, data: { client_information: existing?.client_information } };
        const key = this.redis.key(`mcp:oauth:${state}`);
        const provider = new McpOAuthProvider(pending.data, this.redirectUrl(), async (d) => {
            pending.data = d;
            await this.redis.client.set(key, JSON.stringify(pending), 'EX', SIGN_IN_TTL_SECONDS);
        }, state);
        await this.redis.client.set(key, JSON.stringify(pending), 'EX', SIGN_IN_TTL_SECONDS);
        let result: string;
        try {
            result = await auth(provider, { serverUrl: s.url, fetchFn: this.mcp.guardedFetch });
        } catch (e) {
            await this.redis.client.del(key);
            const msg = (e as Error).message;
            await this.setStatus(id, 'ERROR', `Sign-in could not start: ${msg.slice(0, 160)}`);
            throw new BadRequestException(`This tool server's sign-in could not be started: ${msg.slice(0, 200)}. If it uses an access token instead, add it with "Access token".`);
        }
        if (result === 'AUTHORIZED') {
            await this.saveOAuth(s, provider.data);
            await this.redis.client.del(key);
            await this.refresh(id);
            return { authorization_url: null };
        }
        if (!provider.authorizationUrl) throw new BadRequestException('The tool server did not return a sign-in page');
        return { authorization_url: provider.authorizationUrl.toString() };
    }

    async completeSignIn(actor: Actor, state: string, code: string) {
        const key = this.redis.key(`mcp:oauth:${state}`);
        const raw = await this.redis.client.get(key);
        if (!raw) throw new BadRequestException('This sign-in expired. Start it again from Connections.');
        const pending = JSON.parse(raw) as PendingSignIn;
        if (pending.user_id !== actor.user_id || pending.organization_id !== actor.organization_id) throw new ForbiddenException('This sign-in was started by someone else');
        await this.redis.client.del(key);
        const s = await this.requireManageable(actor, pending.tool_server_id);
        const provider = new McpOAuthProvider(pending.data, this.redirectUrl(), async (d) => {
            pending.data = d;
        }, state);
        try {
            const result = await auth(provider, { serverUrl: s.url, authorizationCode: code, fetchFn: this.mcp.guardedFetch });
            if (result !== 'AUTHORIZED' || !provider.data.tokens) throw new Error('No tokens were returned');
        } catch (e) {
            await this.setStatus(s.id, 'NEEDS_RECONNECTING', 'Sign-in failed. Try again.');
            throw new BadRequestException(`Sign-in failed: ${(e as Error).message.slice(0, 200)}`);
        }
        await this.saveOAuth(s, { client_information: provider.data.client_information, tokens: provider.data.tokens });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'tool_server.signed_in', target_type: 'tool_server', target_id: s.id, metadata: { name: s.name } });
        await this.invalidateCache(s.id);
        await this.refresh(s.id);
        return this.get(actor, s.id);
    }

    private oauthPayload(data: McpOAuthData) {
        const t = data.tokens!;
        return {
            access_token: t.access_token,
            refresh_token: t.refresh_token,
            token_type: t.token_type,
            scope: t.scope,
            expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : undefined,
            oauth: JSON.stringify({ client_information: data.client_information, tokens: t }),
        };
    }

    private async saveOAuth(s: ToolServer, data: McpOAuthData) {
        const payload = this.oauthPayload(data);
        const cred = s.credential_id ? await this.prisma.credential.findFirst({ where: { id: s.credential_id, deleted_at: null } }) : null;
        if (cred) {
            const version = await this.store.replace(cred.secret_resource_name, cred.secret_version, payload);
            await this.prisma.credential.update({ where: { id: cred.id }, data: { secret_version: version, masked_hint: maskSecret(payload.access_token), status: 'ACTIVE', expires_at: payload.expires_at ? new Date(payload.expires_at) : null } });
            return;
        }
        const id = newId();
        const ref = await this.store.create(id, { org_id: s.organization_id, owner_type: s.visibility === 'SHARED' ? 'org' : 'user', kind: 'mcp_oauth' }, payload);
        await this.prisma.credential.create({
            data: {
                id,
                organization_id: s.organization_id,
                owner_type: s.visibility === 'SHARED' ? 'ORGANIZATION' : 'USER',
                owner_id: s.owner_id,
                kind: 'MCP_OAUTH',
                label: `${s.name} – sign-in`,
                service_key: `mcp-${slugify(s.name, 30)}`,
                service_name: s.name,
                visibility: s.visibility,
                masked_hint: maskSecret(payload.access_token),
                secret_resource_name: ref.resource_name,
                secret_version: ref.version,
                expires_at: payload.expires_at ? new Date(payload.expires_at) : null,
            },
        });
        await this.prisma.credentialEvent.create({ data: { credential_id: id, type: 'CREATED', actor_user_id: s.owner_id } });
        await this.prisma.toolServer.update({ where: { id: s.id }, data: { credential_id: id } });
        await this.prisma.connection.updateMany({ where: { tool_server_id: s.id }, data: { credential_id: id } });
    }

    private async loadOAuth(credentialId: string): Promise<McpOAuthData> {
        const cred = await this.prisma.credential.findFirst({ where: { id: credentialId, deleted_at: null } });
        if (!cred) throw new McpAuthError('Sign in to this tool server first.');
        const payload = await this.store.access(cred.secret_resource_name);
        return payload.oauth ? (JSON.parse(payload.oauth) as McpOAuthData) : { tokens: payload.access_token ? { access_token: payload.access_token, token_type: payload.token_type ?? 'bearer', refresh_token: payload.refresh_token } : undefined };
    }

    // ---------------- Runtime (tool listing and calls) ----------------

    /**
     * Authentication for one server. `secrets` collects the raw token values so the agent loop can redact them.
     * OAuth refreshes made by the SDK are written back to the secret store.
     */
    async authFor(s: ToolServer, secrets?: string[]): Promise<McpAuth> {
        if (s.auth_kind === 'NONE') return { kind: 'NONE' };
        if (!s.credential_id) throw new McpAuthError(s.auth_kind === 'OAUTH' ? 'Sign in to this tool server first.' : 'Add the access token for this tool server.');
        if (s.auth_kind === 'TOKEN') {
            const cred = await this.prisma.credential.findFirst({ where: { id: s.credential_id, deleted_at: null } });
            if (!cred) throw new McpAuthError('The access token for this tool server was deleted.');
            const payload = await this.store.access(cred.secret_resource_name);
            const token = payload.access_token ?? payload.api_key ?? '';
            secrets?.push(token);
            return { kind: 'TOKEN', token };
        }
        const data = await this.loadOAuth(s.credential_id);
        if (data.tokens?.access_token) secrets?.push(data.tokens.access_token);
        if (data.tokens?.refresh_token) secrets?.push(data.tokens.refresh_token);
        const provider = new McpOAuthProvider(data, this.redirectUrl(), async (d) => {
            if (!d.tokens) return;
            secrets?.push(d.tokens.access_token, ...(d.tokens.refresh_token ? [d.tokens.refresh_token] : []));
            await this.saveOAuth(s, { client_information: d.client_information, tokens: d.tokens });
        });
        return { kind: 'OAUTH', provider };
    }

    private cacheKey(id: string) {
        return this.redis.key(`cache:mcp:tools:${id}`);
    }

    async invalidateCache(id: string) {
        await this.redis.client.del(this.cacheKey(id));
    }

    /** Tool list, cached for 5 minutes per server. */
    async toolsFor(s: ToolServer, secrets?: string[]): Promise<McpToolInfo[]> {
        const cached = await this.redis.client.get(this.cacheKey(s.id));
        if (cached) return JSON.parse(cached);
        const tools = await this.mcp.listTools(s.url, await this.authFor(s, secrets));
        await this.redis.client.set(this.cacheKey(s.id), JSON.stringify(tools), 'EX', TOOLS_CACHE_SECONDS);
        if (tools.length !== s.tool_count || s.status !== 'ACTIVE') await this.prisma.toolServer.update({ where: { id: s.id }, data: { tool_count: tools.length, last_listed_at: new Date(), status: 'ACTIVE', status_message: null } });
        return tools;
    }

    async call(s: ToolServer, tool: string, args: Record<string, unknown>, secrets: string[]) {
        try {
            return await this.mcp.callTool(s.url, await this.authFor(s, secrets), tool, args);
        } catch (e) {
            if (e instanceof McpAuthError) await this.setStatus(s.id, 'NEEDS_RECONNECTING', e.message);
            throw e;
        }
    }

    /** Connects, lists tools and records the outcome. Never throws. */
    async refresh(id: string): Promise<{ ok: boolean; tool_count: number; tools: { name: string; description?: string }[]; error?: string }> {
        const s = await this.prisma.toolServer.findUnique({ where: { id } });
        if (!s || s.deleted_at) return { ok: false, tool_count: 0, tools: [], error: 'Tool server not found' };
        try {
            const tools = await this.mcp.listTools(s.url, await this.authFor(s));
            await this.redis.client.set(this.cacheKey(id), JSON.stringify(tools), 'EX', TOOLS_CACHE_SECONDS);
            await this.prisma.toolServer.update({ where: { id }, data: { tool_count: tools.length, last_listed_at: new Date(), status: 'ACTIVE', status_message: tools.length ? null : 'Connected, but the server offers no tools' } });
            await this.prisma.connection.updateMany({ where: { tool_server_id: id }, data: { status: 'ACTIVE', status_message: null, last_synced_at: new Date() } });
            if (s.credential_id) await this.prisma.credential.updateMany({ where: { id: s.credential_id }, data: { status: 'ACTIVE', last_tested_at: new Date() } });
            return { ok: true, tool_count: tools.length, tools: tools.map((t) => ({ name: t.name, description: t.description?.slice(0, 200) })) };
        } catch (e) {
            const msg = (e as Error).message;
            const needsAuth = e instanceof McpAuthError;
            await this.setStatus(id, needsAuth ? 'NEEDS_RECONNECTING' : 'ERROR', msg.slice(0, 300));
            if (needsAuth && s.credential_id) await this.prisma.credential.updateMany({ where: { id: s.credential_id }, data: { status: s.auth_kind === 'OAUTH' ? 'NEEDS_RECONNECTING' : 'NOT_WORKING', last_tested_at: new Date() } });
            return { ok: false, tool_count: 0, tools: [], error: msg };
        }
    }

    private async setStatus(id: string, status: 'ACTIVE' | 'ERROR' | 'NEEDS_RECONNECTING', message: string | null) {
        await this.prisma.toolServer.update({ where: { id }, data: { status, status_message: message } });
        await this.prisma.connection.updateMany({ where: { tool_server_id: id }, data: { status, status_message: message } });
    }
}
