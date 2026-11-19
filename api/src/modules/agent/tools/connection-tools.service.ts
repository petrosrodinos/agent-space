import { Injectable, Logger } from '@nestjs/common';
import { Connection, ToolPermission } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { ComposioService, ComposioTool, ComposioToolError, ToolFailureKinds } from '@/integrations/composio/composio.service';
import { SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { AccessService } from '../../access/access.service';
import { ActivityService } from '../../activity/activity.service';
import { classifyToolSlug } from '../approval-policy';
import { assertPublicUrl } from './web.utils';
import { obj, ToolContext, ToolDef } from './tool.types';

const TOOLS_CACHE_SECONDS = 600;
const MAX_TOOLKITS = 6;

/** Tools that act in the user's connected accounts (§8). Tokens never pass through us: Composio executes the call. */
@Injectable()
export class ConnectionToolsService {
    private readonly logger = new Logger(ConnectionToolsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly composio: ComposioService,
        private readonly secrets: SecretStoreService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
    ) { }

    /** Connections this bot may use for this user: explicitly assigned ones, otherwise every connection the user can use. */
    async connectionsFor(ctx: ToolContext): Promise<(Connection & { is_default: boolean })[]> {
        if (!ctx.actor) return [];
        const usable = this.access.usableConnectionsWhere(ctx.organization_id, ctx.actor.user_id, ctx.bot.id);
        const assigned = await this.prisma.botConnection.findMany({ where: { bot_id: ctx.bot.id, connection: usable }, include: { connection: true } });
        const rows = assigned.length
            ? assigned.map((a) => ({ ...a.connection, is_default: a.is_default_for_service }))
            : (await this.prisma.connection.findMany({ where: usable, orderBy: { created_at: 'asc' } })).map((c) => ({ ...c, is_default: false }));
        const defaults = await this.prisma.userServiceDefault.findMany({ where: { user_id: ctx.actor.user_id, organization_id: ctx.organization_id } });
        return rows
            .filter((c) => c.status === 'ACTIVE')
            .map((c) => ({ ...c, is_default: c.is_default || defaults.some((d) => d.connection_id === c.id) }));
    }

    private async toolsForToolkit(slug: string): Promise<ComposioTool[]> {
        const key = this.redis.key(RedisKeys.composioToolsCache(slug));
        const cached = await this.redis.client.get(key);
        if (cached) return JSON.parse(cached);
        const tools = await this.composio.listTools(slug, 20);
        await this.redis.client.set(key, JSON.stringify(tools), 'EX', TOOLS_CACHE_SECONDS);
        return tools;
    }

    /**
     * The Composio user the account was linked under. Stored at connect time; older rows are filled in once from
     * Composio. Never rebuilt from NODE_ENV — a connection made locally (staging) is used by production workers too.
     */
    private async composioUserIdFor(c: Connection): Promise<string> {
        if (c.composio_user_id) return c.composio_user_id;
        const acc = await this.composio.getConnectedAccount(c.composio_connected_account_id!);
        if (!acc.user_id) throw new Error(`${c.service_name}: the connected account has no Composio user. Reconnect it.`);
        await this.prisma.connection.update({ where: { id: c.id }, data: { composio_user_id: acc.user_id } });
        return acc.user_id;
    }

    /**
     * What the bot is told when a connected-service call fails. Only a real sign-in problem asks the user to reconnect;
     * platform failures say so plainly, so the bot never invents account advice from Composio's internal wording.
     */
    private async describeFailure(c: Connection, e: ComposioToolError): Promise<string> {
        if (e.kind === ToolFailureKinds.NEEDS_RECONNECTING) {
            await this.prisma.connection.update({ where: { id: c.id }, data: { status: 'NEEDS_RECONNECTING', status_message: 'Sign-in expired' } });
            return `The "${c.label}" ${c.service_name} sign-in has expired or was revoked. Ask the user to reconnect it on the Connections page.`;
        }
        if (e.kind === ToolFailureKinds.SERVICE_ERROR) return `${c.service_name} returned an error: ${e.detail.slice(0, 500)}`;
        this.logger.error(`Composio platform error on connection ${c.id} (${c.service_key}): ${e.detail}`);
        return `Agent Space couldn't reach ${c.service_name} because of a problem on Agent Space's side. The user's "${c.label}" connection and account are fine, so don't suggest reconnecting or using a different account. Tell the user it failed on our side and that trying again later may work.`;
    }

    /** The acting user's per-tool permissions for these services, keyed `service:TOOL_SLUG`. */
    private async permissionsFor(ctx: ToolContext, services: string[]): Promise<Map<string, ToolPermission>> {
        if (!ctx.actor || !services.length) return new Map();
        const rows = await this.prisma.userToolPermission.findMany({ where: { user_id: ctx.actor.user_id, organization_id: ctx.organization_id, service_key: { in: services } } });
        return new Map(rows.map((r) => [`${r.service_key}:${r.tool_slug}`, r.permission]));
    }

    async tools(ctx: ToolContext): Promise<{ tools: ToolDef[]; summary: string[] }> {
        const conns = await this.connectionsFor(ctx);
        const out: ToolDef[] = [];
        const summary: string[] = [];

        const composioConns = conns.filter((c) => c.kind === 'COMPOSIO' && c.composio_connected_account_id);
        const byService = new Map<string, typeof composioConns>();
        for (const c of composioConns) byService.set(c.service_key, [...(byService.get(c.service_key) ?? []), c]);

        const services = [...byService.keys()].slice(0, MAX_TOOLKITS);
        const permissions = await this.permissionsFor(ctx, services);

        for (const [service, list] of [...byService.entries()].slice(0, MAX_TOOLKITS)) {
            let tools: ComposioTool[] = [];
            try {
                tools = await this.toolsForToolkit(service);
            } catch (e) {
                this.logger.warn(`Could not load tools for ${service}: ${(e as Error).message}`);
                continue;
            }
            const sorted = [...list].sort((a, b) => Number(b.is_default) - Number(a.is_default));
            summary.push(`${list[0].service_name}: ${sorted.map((c) => `"${c.label}"${c.account_identifier ? ` (${c.account_identifier})` : ''}${c.is_default ? ' [default]' : ''}`).join(', ')}`);
            for (const t of tools) {
                const permission = permissions.get(`${service}:${t.slug}`);
                if (permission === 'BLOCKED') continue; // the user blocked it on the service page: never offered
                out.push({ ...this.composioTool(t, sorted), tool_permission: permission });
            }
        }

        const keyConns = conns.filter((c) => c.kind === 'API_KEY' && c.credential_id);
        if (keyConns.length) {
            summary.push(`Access-key services: ${keyConns.map((c) => `"${c.label}" (${c.service_name})`).join(', ')}`);
            out.push(this.callApiTool(keyConns));
        }
        return { tools: out, summary };
    }

    private composioTool(t: ComposioTool, conns: (Connection & { is_default: boolean })[]): ToolDef {
        const params = JSON.parse(JSON.stringify(t.input_parameters ?? { type: 'object', properties: {} }));
        params.type = 'object';
        params.properties = params.properties ?? {};
        delete params.properties.user_id;
        if (Array.isArray(params.required)) params.required = params.required.filter((r: string) => r !== 'user_id');
        if (conns.length > 1) {
            params.properties.account = { type: 'string', enum: conns.map((c) => c.label), description: `Which connected account to use. Default: "${conns[0].label}". Ask the user if unclear.` };
        }
        const pick = (args: any) => (args?.account ? conns.find((c) => c.label === args.account) : undefined) ?? conns[0];
        const verb = t.name || t.slug;
        return {
            name: t.slug.slice(0, 64),
            description: `[${conns[0].service_name}] ${t.description}`.slice(0, 1000),
            parameters: params,
            step_type: 'CONNECTION_CALL',
            runs_on: 'server',
            title: (args) => `${verb} — ${pick(args).label}`,
            classify: (args, ctx) => classifyToolSlug(t.slug, args ?? {}, ctx.user?.email),
            connectionFor: (args) => pick(args).id,
            preview: async (args, ctx) => {
                const c = pick(args);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { account, ...rest } = args ?? {};
                const action = classifyToolSlug(t.slug, rest, ctx.user?.email) ?? 'OTHER';
                return { title: `${verb} with ${c.label}`, action_type: action, preview: { kind: 'tool', service: c.service_name, account: c.label, account_identifier: c.account_identifier, tool: t.slug, input: rest }, requires_tap: action === 'PURCHASE_PAYMENT' };
            },
            execute: async (args, ctx) => {
                const c = pick(args);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { account, ...rest } = args ?? {};
                const log = (successful: boolean, failure?: string) =>
                    this.activity.log({ organization_id: ctx.organization_id, actor_bot_id: ctx.bot.id, on_behalf_of_id: ctx.run.user_id, action: 'connection.used', target_type: 'tool', target_id: t.slug, connection_id: c.id, run_id: ctx.run.id, metadata: { successful, failure } });
                try {
                    const res = await this.composio.executeTool(t.slug, c.composio_connected_account_id!, await this.composioUserIdFor(c), rest);
                    await this.prisma.connection.update({ where: { id: c.id }, data: { last_used_at: new Date() } });
                    await log(true);
                    return { output: res.data, connection_id: c.id };
                } catch (e) {
                    if (!(e instanceof ComposioToolError)) throw e;
                    await log(false, e.kind);
                    throw new Error(await this.describeFailure(c, e));
                }
            },
        };
    }

    /**
     * Access-key services (§8.5): the platform adds the key to the outgoing request at call time and returns only the
     * response, redacted. The model never sees the key.
     */
    private callApiTool(conns: Connection[]): ToolDef {
        return {
            name: 'call_api',
            description: 'Call the HTTP API of a service connected with an access key. The key is added for you (never include it yourself).',
            parameters: obj(
                {
                    connection: { type: 'string', enum: conns.map((c) => c.label) },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                    url: { type: 'string', description: 'Full https URL of the API endpoint' },
                    auth: { type: 'string', description: 'How the key is sent: "bearer" (Authorization: Bearer), "basic" (key as username), "header:<Name>", or "query:<param>". Default bearer.' },
                    body: { type: 'object', description: 'JSON body' },
                },
                ['connection', 'method', 'url'],
            ),
            step_type: 'CONNECTION_CALL',
            runs_on: 'server',
            title: (a) => {
                try {
                    return `${a.method} ${new URL(a.url).hostname} — ${a.connection}`;
                } catch {
                    return `Calling ${a.connection}`;
                }
            },
            classify: (a) => (a.method === 'GET' ? null : a.method === 'DELETE' ? 'DELETE_DATA' : 'EDIT_RECORDS'),
            connectionFor: (a) => conns.find((x) => x.label === a.connection)?.id,
            preview: async (a) => ({ title: `${a.method} ${a.url}`, action_type: a.method === 'DELETE' ? 'DELETE_DATA' : 'EDIT_RECORDS', preview: { kind: 'tool', account: a.connection, input: { method: a.method, url: a.url, body: a.body } } }),
            execute: async (a, ctx) => {
                const c = conns.find((x) => x.label === a.connection);
                if (!c?.credential_id) throw new Error('Unknown connection');
                const cred = await this.prisma.credential.findFirst({ where: { id: c.credential_id, deleted_at: null } });
                if (!cred) throw new Error('This key was deleted. Ask the user for a new one with request_secret.');
                const allowedBots = await this.prisma.botCredential.findMany({ where: { credential_id: cred.id } });
                if (allowedBots.length && !allowedBots.some((b) => b.bot_id === ctx.bot.id)) throw new Error(`This key may not be used by ${ctx.bot.name}`);
                const url = await assertPublicUrl(String(a.url));
                if (url.protocol !== 'https:') throw new Error('Only https APIs can be called with a key');
                const payload = await this.secrets.access(cred.secret_resource_name);
                const key = payload.api_key ?? payload.access_token ?? '';
                ctx.secrets_used.push(key);
                const headers: Record<string, string> = { Accept: 'application/json' };
                const auth = String(a.auth ?? 'bearer');
                if (auth === 'bearer') headers.Authorization = `Bearer ${key}`;
                else if (auth === 'basic') headers.Authorization = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
                else if (auth.startsWith('header:')) headers[auth.slice(7)] = key;
                else if (auth.startsWith('query:')) url.searchParams.set(auth.slice(6), key);
                if (a.body) headers['Content-Type'] = 'application/json';
                const res = await fetch(url, { method: a.method, headers, body: a.body ? JSON.stringify(a.body) : undefined, signal: AbortSignal.timeout(30_000) });
                const text = (await res.text()).slice(0, 30_000);
                let body: unknown = text;
                try {
                    body = JSON.parse(text);
                } catch { /* text */ }
                const now = new Date();
                await this.prisma.credential.update({ where: { id: cred.id }, data: { last_used_at: now, last_used_bot_id: ctx.bot.id, ...(res.status === 401 || res.status === 403 ? { status: 'NOT_WORKING' } : {}) } });
                if (res.status === 401 || res.status === 403) await this.prisma.connection.update({ where: { id: c.id }, data: { status: 'ERROR', status_message: 'The service rejected this key' } });
                else if (res.ok && c.status !== 'ACTIVE') await this.prisma.connection.update({ where: { id: c.id }, data: { status: 'ACTIVE', status_message: null } });
                await this.prisma.credentialEvent.create({ data: { credential_id: cred.id, type: 'USED', actor_bot_id: ctx.bot.id, actor_user_id: ctx.run.user_id, run_id: ctx.run.id, action: `${a.method} ${url.hostname}${url.pathname}`, metadata: { status: res.status } } });
                await this.activity.log({ organization_id: ctx.organization_id, actor_bot_id: ctx.bot.id, on_behalf_of_id: ctx.run.user_id, action: 'secret.used', target_type: 'credential', target_id: cred.id, connection_id: c.id, run_id: ctx.run.id, metadata: { method: a.method, host: url.hostname, status: res.status } });
                return { output: { status: res.status, body }, connection_id: c.id };
            },
        };
    }
}
