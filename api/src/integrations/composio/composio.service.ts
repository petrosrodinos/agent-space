import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE = 'https://backend.composio.dev/api/v3';

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

    private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
        const key = this.config.get<string>('COMPOSIO_API_KEY');
        if (!key) throw new ServiceUnavailableException('Connections are not configured');
        const res = await fetch(`${BASE}${path}`, {
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
            throw new BadGatewayException({ message: `Connection service error: ${String(msg).slice(0, 200)}`, status: res.status });
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

    async listToolkits(params: { search?: string; category?: string; cursor?: string; limit?: number }) {
        const q = new URLSearchParams();
        q.set('limit', String(params.limit ?? 48));
        if (params.search) q.set('search', params.search);
        if (params.category) q.set('category', params.category);
        if (params.cursor) q.set('cursor', params.cursor);
        q.set('sort_by', 'usage');
        const res = await this.call<any>(`/toolkits?${q}`);
        return {
            items: (res.items ?? []).filter((t: any) => !t.deprecated?.isDeprecated).map((t: any) => this.mapToolkit(t)),
            next_cursor: res.next_cursor ?? null,
        };
    }

    async getToolkit(slug: string): Promise<ComposioToolkit> {
        return this.mapToolkit(await this.call<any>(`/toolkits/${encodeURIComponent(slug)}`));
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
        const important = await this.call<any>(`/tools?toolkit_slug=${encodeURIComponent(toolkitSlug)}&important=true&limit=${limit}`);
        let items = (important.items ?? []).filter((t: any) => !t.is_deprecated);
        if (items.length < 5) {
            const all = await this.call<any>(`/tools?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=${limit}`);
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
    async executeTool(toolSlug: string, connectedAccountId: string, userId: string, args: Record<string, unknown>) {
        let res: any;
        try {
            res = await this.call<any>(`/tools/execute/${encodeURIComponent(toolSlug)}`, {
                method: 'POST',
                body: JSON.stringify({ connected_account_id: connectedAccountId, user_id: userId, arguments: args }),
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
}
