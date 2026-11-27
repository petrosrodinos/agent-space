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
import { undoPlanFor } from '../undo/undo.rules';
import { assertPublicUrl } from './web.utils';
import { obj, ToolContext, ToolDef } from './tool.types';

const TOOLS_CACHE_SECONDS = 600;
const LOADED_TOOL_CACHE_SECONDS = 86_400;
const MAX_TOOLKITS = 6;
/** A toolkit with at most this many tools is offered whole; bigger ones start with their important tools. */
const FULL_TOOLKIT_MAX = 30;
const IMPORTANT_TOOLS_MAX = 20;
const SEARCH_RESULTS_MAX = 8;
/** Cap on tools one run can add with find_connection_tools, so the tool list stays a size models handle well. */
const LOADED_TOOLS_MAX = 24;

interface ToolkitTools {
    tools: ComposioTool[];
    /** The whole toolkit: there is nothing more to find with find_connection_tools. */
    complete: boolean;
}

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

    /**
     * The tools a bot starts with for a service. A small toolkit (Gmail has ~23) is offered whole, so nothing the user
     * allowed on the service page is missing. A big one (Slack, HubSpot, GitHub have hundreds) gets Composio's important
     * tools, and the bot finds the rest with find_connection_tools.
     */
    private async toolsForToolkit(slug: string): Promise<ToolkitTools> {
        const key = this.redis.key(RedisKeys.composioToolsCache(slug));
        const cached = await this.redis.client.get(key);
        if (cached) return JSON.parse(cached);
        const all = await this.composio.listSmallToolkitTools(slug, FULL_TOOLKIT_MAX);
        const value: ToolkitTools = all ? { tools: all, complete: true } : { tools: await this.composio.listTools(slug, IMPORTANT_TOOLS_MAX), complete: false };
        await this.redis.client.set(key, JSON.stringify(value), 'EX', TOOLS_CACHE_SECONDS);
        return value;
    }

    private async cacheTool(t: ComposioTool) {
        await this.redis.client.set(this.redis.key(RedisKeys.composioToolCache(t.slug)), JSON.stringify(t), 'EX', LOADED_TOOL_CACHE_SECONDS);
    }

    /** Definitions of tools loaded earlier in this run; a cache miss is looked up again by name. */
    private async loadedToolDefs(service: string, slugs: string[]): Promise<ComposioTool[]> {
        const out: ComposioTool[] = [];
        for (const slug of slugs) {
            const cached = await this.redis.client.get(this.redis.key(RedisKeys.composioToolCache(slug)));
            if (cached) {
                out.push(JSON.parse(cached));
                continue;
            }
            const found = (await this.composio.searchTools(service, slug, 5)).find((t) => t.slug === slug);
            if (found) {
                await this.cacheTool(found);
                out.push(found);
            }
        }
        return out;
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

        const searchable: { service: string; name: string; conns: (Connection & { is_default: boolean })[] }[] = [];
        const offered = new Set<string>();
        for (const [service, list] of [...byService.entries()].slice(0, MAX_TOOLKITS)) {
            let toolkit: ToolkitTools;
            try {
                toolkit = await this.toolsForToolkit(service);
            } catch (e) {
                this.logger.warn(`Could not load tools for ${service}: ${(e as Error).message}`);
                continue;
            }
            const sorted = [...list].sort((a, b) => Number(b.is_default) - Number(a.is_default));
            const name = list[0].service_name;
            summary.push(`${name}: ${sorted.map((c) => `"${c.label}"${c.account_identifier ? ` (${c.account_identifier})` : ''}${c.is_default ? ' [default]' : ''}`).join(', ')}${toolkit.complete ? '' : ` (more ${name} tools: find_connection_tools)`}`);
            if (!toolkit.complete) searchable.push({ service, name, conns: sorted });
            const loaded = (ctx.loaded_tools ?? []).filter((l) => l.service === service && !toolkit.tools.some((t) => t.slug === l.slug)).map((l) => l.slug);
            const extra = loaded.length ? await this.loadedToolDefs(service, loaded).catch(() => []) : [];
            for (const t of [...toolkit.tools, ...extra]) {
                const permission = permissions.get(`${service}:${t.slug}`);
                if (permission === 'BLOCKED' || offered.has(t.slug)) continue; // the user blocked it on the service page: never offered
                offered.add(t.slug);
                out.push({ ...this.composioTool(t, sorted), tool_permission: permission });
            }
        }
        if (searchable.length) out.push(this.findToolsTool(searchable, permissions, offered));

        const keyConns = conns.filter((c) => c.kind === 'API_KEY' && c.credential_id);
        if (keyConns.length) {
            summary.push(`Access-key services: ${keyConns.map((c) => `"${c.label}" (${c.service_name})`).join(', ')}`);
            out.push(this.callApiTool(keyConns));
        }
        return { tools: out, summary };
    }

    /**
     * Big toolkits only start with their important tools. This searches the whole toolkit and adds the matches to the
     * bot's tools for the rest of the run, so it can do anything the user allowed on the service page.
     */
    private findToolsTool(services: { service: string; name: string; conns: (Connection & { is_default: boolean })[] }[], permissions: Map<string, ToolPermission>, offered: Set<string>): ToolDef {
        return {
            name: 'find_connection_tools',
            description: `Find more tools for a connected service when the ones you have can't do the job (for example labels, permissions, comments, admin actions). Searches the service's full tool catalog and makes the matches available from your next step. Search before telling the user something can't be done. Services: ${services.map((s) => `${s.service} (${s.name})`).join(', ')}.`,
            parameters: obj(
                {
                    service: { type: 'string', enum: services.map((s) => s.service) },
                    query: { type: 'string', description: 'What you need to do, in a few words, e.g. "add label to email" or "share file".' },
                },
                ['service', 'query'],
            ),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: (a) => `Looking for ${services.find((s) => s.service === a.service)?.name ?? a.service} tools: ${String(a.query ?? '').slice(0, 60)}`,
            execute: async (a, ctx) => {
                const target = services.find((s) => s.service === a.service);
                if (!target) throw new Error(`Unknown service. Use one of: ${services.map((s) => s.service).join(', ')}`);
                const found = (await this.composio.searchTools(target.service, String(a.query ?? '').slice(0, 120), SEARCH_RESULTS_MAX)).filter((t) => permissions.get(`${target.service}:${t.slug}`) !== 'BLOCKED');
                ctx.loaded_tools ??= [];
                const added: ComposioTool[] = [];
                for (const t of found) {
                    if (offered.has(t.slug) || ctx.loaded_tools.some((l) => l.slug === t.slug)) continue;
                    if (ctx.loaded_tools.length >= LOADED_TOOLS_MAX) break;
                    await this.cacheTool(t);
                    ctx.loaded_tools.push({ service: target.service, slug: t.slug });
                    added.push(t);
                }
                if (added.length) ctx.tools_changed = true;
                const already = found.filter((t) => offered.has(t.slug)).map((t) => t.slug);
                return {
                    output: {
                        loaded: added.map((t) => ({ tool: t.slug, description: t.description.slice(0, 200) })),
                        ...(already.length ? { already_available: already } : {}),
                        note: added.length || already.length ? 'These tools are available now. Call them directly.' : 'Nothing matched. Try other words, or tell the user this service has no tool for it.',
                    },
                };
            },
        };
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
                    const plan = undoPlanFor(t.slug, rest, res.data);
                    return { output: res.data, connection_id: c.id, ...(plan ? { undo: { ...plan, connection_id: c.id } } : {}) };
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
