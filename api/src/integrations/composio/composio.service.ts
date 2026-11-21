import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE = 'https://backend.composio.dev/api';

/** API versions. Custom MCP toolkits are managed under v3.1; everything else still uses v3. */
const ApiVersions = { V3: 'v3', V3_1: 'v3.1' } as const;
type ApiVersion = (typeof ApiVersions)[keyof typeof ApiVersions];

/** Custom MCP toolkits (and their tools) are slugged CUSTOM_<NAME>. */
export const CUSTOM_TOOLKIT_PREFIX = 'CUSTOM_';
export const isCustomToolkit = (slug: string | null | undefined) => !!slug && slug.toUpperCase().startsWith(CUSTOM_TOOLKIT_PREFIX);

/** How a custom MCP server authenticates, in Composio's terms. */
export const CustomAuthModes = { NO_AUTH: 'NO_AUTH', API_KEY: 'API_KEY', DCR_OAUTH: 'DCR_OAUTH' } as const;
export type CustomAuthMode = (typeof CustomAuthModes)[keyof typeof CustomAuthModes];

/** Custom toolkits are shared across the Composio project; every connected account still belongs to one Composio user. */
const SHARED_TOOLKIT_USER = 'all';
/** The access token is sent to the MCP server as a bearer header; Composio fills in each account's key. */
const API_KEY_FIELD = 'generic_api_key';
const API_KEY_HEADERS = { Authorization: `Bearer {{${API_KEY_FIELD}}}` };
/** Custom toolkit tools only exist in the latest toolkit version; v3 reads a pinned version without them. */
const LATEST_VERSION = 'latest';
const SHARED_TOOLKIT_EXISTS = 'CustomToolkit_SharedToolkitExists';

export interface CustomToolkit {
    slug: string;
    url: string;
    auth_mode: CustomAuthMode | null;
}

export interface ComposioToolkit {
    slug: string;
    name: string;
    logo: string | null;
    description: string | null;
    categories: string[];
    auth_schemes: string[];
    managed: boolean;
    no_auth: boolean;
    tools_count: number;
    website: string | null;
}

export interface ComposioTool {
    slug: string;
    name: string;
    description: string;
    toolkit: string;
    input_parameters: Record<string, unknown>;
    tags: string[];
}

/** Why a connected-service tool call failed — decides what the bot is told and whether the connection needs a new sign-in. */
export const ToolFailureKinds = {
    /** The sign-in expired, was revoked or the account is gone: the user must reconnect. */
    NEEDS_RECONNECTING: 'NEEDS_RECONNECTING',
    /** The service itself (Linear, Gmail…) rejected the request: bad input, missing access, not found… */
    SERVICE_ERROR: 'SERVICE_ERROR',
    /** Agent Space or Composio failed (configuration, outage). Nothing the user can fix. */
    PLATFORM_ERROR: 'PLATFORM_ERROR',
} as const;
export type ToolFailureKind = (typeof ToolFailureKinds)[keyof typeof ToolFailureKinds];

const NEEDS_RECONNECTING_PATTERN = /expired|revoked|invalid_grant|unauthori[sz]ed|not active|inactive|re-?auth|ConnectedAccountNotFound|\b401\b/i;

/** Thrown by executeTool so callers can tell the user the right thing instead of relaying raw Composio errors. */
export interface ComposioTriggerType {
    slug: string;
    name: string;
    description: string;
    /** JSON schema of the trigger's settings (e.g. a label or channel to watch). */
    config: Record<string, unknown>;
    toolkit: string;
}

export class ComposioToolError extends Error {
    constructor(
        readonly kind: ToolFailureKind,
        readonly detail: string,
    ) {
        super(detail);
    }
}

export interface ComposioConnectedAccount {
    id: string;
    status: string;
    toolkit: string;
    auth_config_id: string | null;
    account_identifier: string | null;
    /** The Composio user the account is linked under — tool calls must send exactly this. */
    user_id: string | null;
}

/**
 * Connection partner (§8.1, §8.7). Tokens never pass through our services: Agent Space keeps only the
 * connected-account ID and executes tools through Composio.
 */
@Injectable()
export class ComposioService {
    private readonly logger = new Logger(ComposioService.name);

    constructor(private readonly config: ConfigService) { }

    get configured() {
        return !!this.config.get('COMPOSIO_API_KEY');
    }

    /**
     * Composio user ID for a NEW sign-in, namespaced so a shared Composio project never mixes apps or environments.
     * Never recompute it for an existing connection (NODE_ENV and visibility may differ by then): use the stored
     * `connection.composio_user_id`.
     */
    userId(organizationId: string, ownerKey: string) {
        return `agentspace:${this.config.get('NODE_ENV')}:${organizationId}:${ownerKey}`;
    }

    private async call<T>(path: string, init: RequestInit = {}, version: ApiVersion = ApiVersions.V3): Promise<T> {
        const key = this.config.get<string>('COMPOSIO_API_KEY');
        if (!key) throw new ServiceUnavailableException('Connections are not configured');
        const res = await fetch(`${BASE}/${version}${path}`, {
            ...init,
            headers: { 'x-api-key': key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
        const text = await res.text();
        let body: any = text;
        try {
            body = text ? JSON.parse(text) : {};
        } catch { /* plain text */ }
        if (!res.ok) {
            const msg = body?.error?.message || body?.message || (typeof body === 'string' ? body : res.statusText);
            this.logger.warn(`Composio ${init.method ?? 'GET'} ${path} -> ${res.status}: ${String(msg).slice(0, 300)}`);
            throw new BadGatewayException({ message: `Connection service error: ${String(msg).slice(0, 200)}`, status: res.status, error_slug: body?.error?.slug ?? null, detail: String(msg).slice(0, 500) });
        }
        return body as T;
    }

    private mapToolkit(t: any): ComposioToolkit {
        return {
            slug: t.slug,
            name: t.name,
            logo: t.meta?.logo ?? null,
            description: t.meta?.description ?? null,
            categories: (t.meta?.categories ?? []).map((c: any) => c.name ?? c.id),
            auth_schemes: t.auth_schemes ?? [],
            managed: (t.composio_managed_auth_schemes ?? []).length > 0,
            no_auth: !!t.no_auth,
            tools_count: t.meta?.tools_count ?? 0,
            website: t.meta?.app_url ?? null,
        };
    }

    // ---------------- Triggers (§10.2 "When something happens in a connected service") ----------------

    /** Events a service can start an automation with, e.g. GMAIL_NEW_GMAIL_MESSAGE. `config` is a JSON schema. */
    async listTriggerTypes(toolkitSlug: string): Promise<ComposioTriggerType[]> {
        const res = await this.call<{ items: any[] }>(`/triggers_types?toolkit_slugs=${encodeURIComponent(toolkitSlug)}&limit=100`);
        return (res.items ?? []).map((t) => ({ slug: t.slug, name: t.name ?? t.slug, description: t.description ?? '', config: t.config ?? { type: 'object', properties: {} }, toolkit: toolkitSlug }));
    }

    async getTriggerType(slug: string): Promise<ComposioTriggerType> {
        const t = await this.call<any>(`/triggers_types/${encodeURIComponent(slug)}`);
        return { slug: t.slug, name: t.name ?? t.slug, description: t.description ?? '', config: t.config ?? { type: 'object', properties: {} }, toolkit: t.toolkit?.slug ?? '' };
    }

    /** Starts watching for an event on one connected account; Composio then sends it to our webhook. Returns the trigger id. */
    async upsertTrigger(slug: string, connectedAccountId: string, userId: string, config: Record<string, unknown>): Promise<string> {
        const res = await this.call<{ trigger_id?: string; id?: string }>(`/trigger_instances/${encodeURIComponent(slug)}/upsert`, {
            method: 'POST',
            body: JSON.stringify({ connected_account_id: connectedAccountId, user_id: userId, trigger_config: config ?? {} }),
        });
        const id = res.trigger_id ?? res.id;
        if (!id) throw new BadGatewayException('The connection service did not return a trigger');
        return id;
    }

    async setTriggerEnabled(triggerId: string, enabled: boolean) {
        await this.call(`/trigger_instances/manage/${encodeURIComponent(triggerId)}`, { method: 'PATCH', body: JSON.stringify({ status: enabled ? 'enable' : 'disable' }) });
    }

    async deleteTrigger(triggerId: string) {
        await this.call(`/trigger_instances/manage/${encodeURIComponent(triggerId)}`, { method: 'DELETE' });
    }

    async listToolkits(params: { search?: string; category?: string; cursor?: string; limit?: number }) {
        const q = new URLSearchParams();
        q.set('limit', String(params.limit ?? 48));
        if (params.search) q.set('search', params.search);
        if (params.category) q.set('category', params.category);
        if (params.cursor) q.set('cursor', params.cursor);
        q.set('sort_by', 'usage');
        const res = await this.call<any>(`/toolkits?${q}`);
        return {
            // Custom MCP toolkits are shared across the whole Composio project (every organisation): never list them in the catalog.
            items: (res.items ?? []).filter((t: any) => !t.deprecated?.isDeprecated && !isCustomToolkit(t.slug)).map((t: any) => this.mapToolkit(t)),
            next_cursor: res.next_cursor ?? null,
        };
    }

    async getToolkit(slug: string): Promise<ComposioToolkit> {
        return this.mapToolkit(await this.call<any>(`/toolkits/${encodeURIComponent(slug)}`, {}, isCustomToolkit(slug) ? ApiVersions.V3_1 : ApiVersions.V3));
    }

    /** Query string that makes the v3 tools API return a custom toolkit's tools. */
    private versionQuery(toolkitSlug: string) {
        return isCustomToolkit(toolkitSlug) ? `&toolkit_versions=${LATEST_VERSION}` : '';
    }

    async listCategories(): Promise<{ id: string; name: string }[]> {
        const res = await this.call<any>('/toolkits/categories');
        const seen = new Set<string>();
        return (res.items ?? []).filter((c: any) => {
            const k = String(c.name ?? c.id).toLowerCase();
            return seen.has(k) ? false : (seen.add(k), true);
        });
    }

    /** Finds a Composio-managed auth config for the toolkit, creating one when needed. */
    async ensureAuthConfig(toolkitSlug: string): Promise<string> {
        const res = await this.call<any>(`/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}`);
        const existing = (res.items ?? []).find((a: any) => a.is_composio_managed && a.status !== 'DISABLED' && !a.is_disabled);
        if (existing) return existing.id;
        const created = await this.call<any>('/auth_configs', {
            method: 'POST',
            body: JSON.stringify({ toolkit: { slug: toolkitSlug }, auth_config: { type: 'use_composio_managed_auth' } }),
        });
        return created.auth_config?.id ?? created.id;
    }

    /** Starts the service's normal sign-in screen; returns the redirect URL and the new connected-account ID. */
    async initiateConnection(authConfigId: string, userId: string, callbackUrl: string) {
        // Composio-managed OAuth uses hosted "connect links" (the service's own sign-in screen).
        const res = await this.call<any>('/connected_accounts/link', {
            method: 'POST',
            body: JSON.stringify({ auth_config_id: authConfigId, user_id: userId, callback_url: callbackUrl }),
        });
        return {
            connected_account_id: (res.connected_account_id ?? res.id) as string,
            redirect_url: (res.redirect_url ?? res.redirect_uri ?? null) as string | null,
            status: 'INITIATED',
        };
    }

    async getConnectedAccount(id: string): Promise<ComposioConnectedAccount> {
        const a = await this.call<any>(`/connected_accounts/${encodeURIComponent(id)}`);
        const val = a.state?.val ?? a.data ?? a.params ?? {};
        const identifier = val.email ?? val.user_email ?? val.account_email ?? val.username ?? val.login ?? a.alias ?? null;
        return {
            id: a.id,
            status: a.status,
            toolkit: a.toolkit?.slug ?? a.toolkit_slug ?? '',
            auth_config_id: a.auth_config?.id ?? null,
            account_identifier: typeof identifier === 'string' ? identifier : null,
            user_id: typeof a.user_id === 'string' ? a.user_id : null,
        };
    }

    async deleteConnectedAccount(id: string) {
        await this.call(`/connected_accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => {
            if ((e as any)?.response?.status !== 404) throw e;
        });
    }

    /** "Important" tools for a toolkit — the narrowed tool list offered to the model (§7.6 "same tool selection"). */
    async listTools(toolkitSlug: string, limit = 25): Promise<ComposioTool[]> {
        const map = (t: any): ComposioTool => ({
            slug: t.slug,
            name: t.name,
            description: (t.description ?? t.human_description ?? '').slice(0, 900),
            toolkit: t.toolkit?.slug ?? toolkitSlug,
            input_parameters: t.input_parameters ?? { type: 'object', properties: {} },
            tags: t.tags ?? [],
        });
        const v = this.versionQuery(toolkitSlug);
        // Custom MCP toolkits have no "important" tools: take them all.
        const important = isCustomToolkit(toolkitSlug) ? { items: [] } : await this.call<any>(`/tools?toolkit_slug=${encodeURIComponent(toolkitSlug)}&important=true&limit=${limit}`);
        let items = (important.items ?? []).filter((t: any) => !t.is_deprecated);
        if (items.length < 5) {
            const all = await this.call<any>(`/tools?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=${limit}${v}`);
            const seen = new Set(items.map((t: any) => t.slug));
            items = items.concat((all.items ?? []).filter((t: any) => !t.is_deprecated && !seen.has(t.slug)));
        }
        return items.slice(0, limit).map(map);
    }

    /** Every tool of a toolkit (cursor-paged), for the service details page. Capped so a huge toolkit can't stall the request. */
    async listAllTools(toolkitSlug: string, max = 500): Promise<ComposioTool[]> {
        const out: ComposioTool[] = [];
        let cursor: string | null = null;
        do {
            const q = new URLSearchParams({ toolkit_slug: toolkitSlug, limit: '200' });
            if (isCustomToolkit(toolkitSlug)) q.set('toolkit_versions', LATEST_VERSION);
            if (cursor) q.set('cursor', cursor);
            const res = await this.call<any>(`/tools?${q}`);
            for (const t of res.items ?? []) {
                if (t.is_deprecated) continue;
                out.push({ slug: t.slug, name: t.name, description: (t.description ?? t.human_description ?? '').slice(0, 900), toolkit: t.toolkit?.slug ?? toolkitSlug, input_parameters: {}, tags: t.tags ?? [] });
            }
            cursor = res.next_cursor ?? null;
        } while (cursor && out.length < max);
        return out.slice(0, max);
    }

    /**
     * Raw API request made by Composio with the stored sign-in (§9.5 "proxy execution"). The token never reaches us
     * or the cloud computer; we only receive the response.
     */
    async proxy(connectedAccountId: string, req: { endpoint: string; method: 'GET' | 'POST'; body?: unknown; parameters?: { name: string; value: string; in: 'query' | 'header' }[] }) {
        const res = await this.call<any>('/tools/execute/proxy', {
            method: 'POST',
            body: JSON.stringify({ connected_account_id: connectedAccountId, endpoint: req.endpoint, method: req.method, body: req.body, parameters: req.parameters ?? [] }),
        });
        return { status: Number(res.status ?? 200), data: res.data ?? null, headers: (res.headers ?? {}) as Record<string, string> };
    }

    /**
     * Runs a tool with a connected account. Failures throw ComposioToolError, classified so the bot never relays
     * Composio's internal wording (e.g. "user ID does not match") as if it were a problem with the user's account.
     */
    async executeTool(toolSlug: string, connectedAccountId: string | null, userId: string, args: Record<string, unknown>) {
        let res: any;
        try {
            res = await this.call<any>(`/tools/execute/${encodeURIComponent(toolSlug)}`, {
                method: 'POST',
                body: JSON.stringify({
                    // Custom MCP servers without sign-in have no connected account: the Composio user is enough.
                    ...(connectedAccountId ? { connected_account_id: connectedAccountId } : {}),
                    user_id: userId,
                    arguments: args,
                    ...(isCustomToolkit(toolSlug) ? { version: LATEST_VERSION } : {}),
                }),
            });
        } catch (e) {
            // Composio refused the call itself: either the sign-in is unusable, or it's on our side.
            const detail = (e as Error).message;
            throw new ComposioToolError(NEEDS_RECONNECTING_PATTERN.test(detail) ? ToolFailureKinds.NEEDS_RECONNECTING : ToolFailureKinds.PLATFORM_ERROR, detail);
        }
        if (res.successful === false || res.error) {
            // The call reached the service, which returned an error.
            const detail = typeof res.error === 'string' ? res.error : JSON.stringify(res.error ?? res.data ?? 'Unknown error');
            throw new ComposioToolError(NEEDS_RECONNECTING_PATTERN.test(detail) ? ToolFailureKinds.NEEDS_RECONNECTING : ToolFailureKinds.SERVICE_ERROR, detail);
        }
        return { data: res.data ?? null };
    }

    // ---------------- Custom MCP toolkits (§8.4) ----------------

    private mapCustomToolkit(t: any): CustomToolkit {
        const modes: string[] = t.auth_schemes ?? (t.auth_config_details ?? []).map((a: any) => a.mode);
        const known = Object.values(CustomAuthModes) as string[];
        return { slug: String(t.slug).toUpperCase(), url: t.meta?.app_url ?? t.base_url ?? '', auth_mode: (modes.find((m) => known.includes(m)) as CustomAuthMode | undefined) ?? null };
    }

    async getCustomToolkit(slug: string): Promise<CustomToolkit> {
        return this.mapCustomToolkit(await this.call<any>(`/toolkits/${encodeURIComponent(slug)}`, {}, ApiVersions.V3_1));
    }

    /**
     * Registers an MCP server as a shared custom toolkit, or returns the one already registered for that address (the
     * caller checks its sign-in type). Toolkits are never deleted by us: other organisations or environments sharing
     * the Composio project may use the same one. Each user's sign-in still lives in their own connected account.
     */
    async ensureCustomToolkit(url: string, mode: CustomAuthMode, discoveryUrl?: string): Promise<CustomToolkit> {
        const scheme = mode === CustomAuthModes.DCR_OAUTH ? { mode, discovery_url: discoveryUrl } : mode === CustomAuthModes.API_KEY ? { mode, headers: API_KEY_HEADERS } : { mode };
        const u = new URL(url);
        const name = `${u.host}${u.pathname === '/' ? '' : u.pathname}`.slice(0, 80);
        try {
            const res = await this.call<{ slug: string }>('/custom/toolkits', { method: 'POST', body: JSON.stringify({ name, mcp_url: url, auth_schemes: [scheme], user_id: SHARED_TOOLKIT_USER }) }, ApiVersions.V3_1);
            return { slug: res.slug.toUpperCase(), url, auth_mode: mode };
        } catch (e) {
            const r = e instanceof BadGatewayException ? (e.getResponse() as { error_slug?: string; detail?: string }) : null;
            const existing = r?.error_slug === SHARED_TOOLKIT_EXISTS ? r.detail?.match(/CUSTOM_[A-Z0-9_]+/)?.[0] : undefined;
            if (!existing) throw e;
            return this.getCustomToolkit(existing);
        }
    }

    /** Re-reads the server's tool list. Composio never does this on its own when the server's tools change. */
    async syncCustomToolkit(slug: string, connectedAccountId?: string | null) {
        await this.call('/custom/toolkits/sync', { method: 'POST', body: JSON.stringify({ slug, ...(connectedAccountId ? { connected_account_id: connectedAccountId } : {}) }) }, ApiVersions.V3_1);
    }

    /** The toolkit's auth config (one per custom toolkit, shared by every account linked to it), created on first use. */
    async ensureCustomAuthConfig(slug: string, mode: Exclude<CustomAuthMode, 'NO_AUTH'>): Promise<string> {
        const res = await this.call<any>(`/auth_configs?toolkit_slug=${encodeURIComponent(slug)}`, {}, ApiVersions.V3_1);
        const existing = (res.items ?? []).find((a: any) => a.status === 'ENABLED' && a.auth_scheme === mode);
        if (existing) return existing.id;
        const created = await this.call<any>(
            '/auth_configs',
            { method: 'POST', body: JSON.stringify({ toolkit: { slug }, auth_config: { type: 'use_custom_auth', authScheme: mode, credentials: {} } }) },
            ApiVersions.V3_1,
        );
        return created.auth_config?.id ?? created.id;
    }

    /** Links an access token to a Composio user. The token goes straight to Composio; Agent Space keeps only the account ID. */
    async connectWithApiKey(authConfigId: string, userId: string, apiKey: string): Promise<string> {
        const res = await this.call<any>('/connected_accounts', {
            method: 'POST',
            body: JSON.stringify({ auth_config: { id: authConfigId }, connection: { user_id: userId, state: { authScheme: CustomAuthModes.API_KEY, val: { status: 'ACTIVE', [API_KEY_FIELD]: apiKey } } } }),
        });
        if (!res.id) throw new BadGatewayException('The connection service did not return an account');
        return res.id as string;
    }
}
