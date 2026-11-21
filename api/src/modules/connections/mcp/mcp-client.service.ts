import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { assertPublicUrl } from '../../agent/tools/web.utils';

export type McpAuth = { kind: 'NONE' } | { kind: 'TOKEN'; token: string } | { kind: 'OAUTH'; provider: OAuthClientProvider };

export interface McpToolInfo {
    name: string;
    title?: string;
    description?: string;
    input_schema: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean; title?: string };
}

/** The server needs (re-)authentication: wrong/expired token or OAuth sign-in required. */
export class McpAuthError extends Error { }

const CONNECT_TIMEOUT_MS = 20_000;
const CALL_TIMEOUT_MS = 110_000;
const MAX_RESULT_CHARS = 30_000;

/**
 * Client for custom tool servers (§8.4) over MCP Streamable HTTP, falling back to the older SSE transport.
 * Every request goes through an SSRF guard; secrets are only ever added as request headers here.
 */
@Injectable()
export class McpClientService {
    private readonly logger = new Logger(McpClientService.name);
    private readonly production: boolean;

    constructor(config: ConfigService) {
        this.production = config.get('NODE_ENV') === 'production';
    }

    private isLocal(url: URL) {
        return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
    }

    /** https only in production; plain http only for localhost in development. Private networks are refused. */
    async validateUrl(raw: string): Promise<URL> {
        let url: URL;
        try {
            url = new URL(raw.trim());
        } catch {
            throw new Error('Enter a valid address, e.g. https://tools.example.com/mcp');
        }
        if (url.username || url.password) throw new Error('Put credentials in the access token field, not in the address');
        if (!this.production && this.isLocal(url) && ['http:', 'https:'].includes(url.protocol)) return url;
        if (url.protocol !== 'https:') throw new Error('Tool servers must use https');
        try {
            await assertPublicUrl(url.toString());
        } catch {
            throw new Error('That address is not allowed (private or internal network)');
        }
        return url;
    }

    /** fetch that re-checks every URL it is asked to call (redirect targets, OAuth endpoints, SSE POST URLs). */
    /** Also used for the OAuth discovery, registration and token calls. */
    guardedFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        let target = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        for (let hop = 0; hop < 5; hop++) {
            await this.validateUrl(target);
            const res = await fetch(hop === 0 ? (input as any) : target, { ...init, redirect: 'manual' } as RequestInit);
            const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
            if (!location) return res;
            target = new URL(location, target).toString();
            // Only GET/HEAD are re-sent on redirects; other methods would silently drop or change their body.
            if (init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) return res;
        }
        throw new Error('Too many redirects');
    };

    private transports(url: URL, auth: McpAuth): (() => Transport)[] {
        const headers: Record<string, string> = auth.kind === 'TOKEN' ? { Authorization: `Bearer ${auth.token}` } : {};
        const authProvider = auth.kind === 'OAUTH' ? auth.provider : undefined;
        return [
            () => new StreamableHTTPClientTransport(url, { requestInit: { headers }, authProvider, fetch: this.guardedFetch }),
            () => new SSEClientTransport(url, { requestInit: { headers }, eventSourceInit: { fetch: (u, i) => this.guardedFetch(u, { ...i, headers: { ...(i?.headers as Record<string, string>), ...headers } }) } as any, authProvider, fetch: this.guardedFetch }),
        ];
    }

    private isAuthError(e: unknown) {
        const msg = (e as Error)?.message ?? '';
        // Only a genuine 401 / invalid token means "sign in again". 403 and free-text like "forbidden" are often a
        // per-tool permission, WAF or Origin/Host rejection and must not log the server out.
        return e instanceof UnauthorizedError || /\b401\b|invalid[_ ]token|invalid[_ ]grant/i.test(msg);
    }

    /** Connects (Streamable HTTP, then SSE), runs fn, always closes. */
    async withClient<T>(rawUrl: string, auth: McpAuth, fn: (client: Client) => Promise<T>): Promise<T> {
        const url = await this.validateUrl(rawUrl);
        let lastError: unknown;
        for (const make of this.transports(url, auth)) {
            const client = new Client({ name: 'agent-space', version: '1.0.0' }, { capabilities: {} });
            const transport = make();
            try {
                await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
            } catch (e) {
                // Keep the first (Streamable HTTP) error: the SSE fallback's 404/405 would otherwise hide the real cause.
                lastError ??= e;
                await client.close().catch(() => undefined);
                if (this.isAuthError(e)) throw new McpAuthError('The tool server needs you to sign in again (the access token was rejected or expired).');
                continue;
            }
            try {
                return await fn(client);
            } catch (e) {
                if (this.isAuthError(e)) throw new McpAuthError('The tool server rejected the sign-in (token expired or revoked).');
                throw e;
            } finally {
                await client.close().catch(() => undefined);
            }
        }
        const msg = (lastError as Error)?.message ?? 'unknown error';
        this.logger.warn(`MCP connect failed for ${url.host}: ${msg}`);
        throw new Error(`Couldn't connect to the tool server: ${friendly(msg)}`);
    }

    async listTools(url: string, auth: McpAuth): Promise<McpToolInfo[]> {
        return this.withClient(url, auth, async (client) => {
            const out: McpToolInfo[] = [];
            let cursor: string | undefined;
            for (let page = 0; page < 10; page++) {
                const res = await client.listTools(cursor ? { cursor } : undefined, { timeout: CONNECT_TIMEOUT_MS });
                for (const t of res.tools) {
                    out.push({ name: t.name, title: t.title ?? t.annotations?.title, description: t.description, input_schema: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>, annotations: t.annotations });
                }
                cursor = res.nextCursor;
                if (!cursor) break;
            }
            return out;
        });
    }

    /** Calls one tool and flattens the result into something the model can read (text, structured data, resource links). */
    async callTool(url: string, auth: McpAuth, name: string, args: Record<string, unknown>) {
        return this.withClient(url, auth, async (client) => {
            const res: any = await client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS, resetTimeoutOnProgress: true });
            const parts: unknown[] = [];
            for (const c of (res.content ?? []) as any[]) {
                if (c.type === 'text') parts.push(c.text);
                else if (c.type === 'resource') parts.push(c.resource?.text ?? { uri: c.resource?.uri, mimeType: c.resource?.mimeType });
                else if (c.type === 'resource_link') parts.push({ link: c.uri, name: c.name });
                else if (c.type === 'image' || c.type === 'audio') parts.push(`[${c.type} returned (${c.mimeType})]`);
            }
            let text = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('\n');
            if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [truncated]`;
            return { is_error: !!res.isError, content: text, structured: res.structuredContent ?? undefined };
        });
    }
}

function friendly(msg: string) {
    if (/ENOTFOUND|getaddrinfo/i.test(msg)) return 'the address could not be found.';
    if (/ECONNREFUSED/i.test(msg)) return 'the server refused the connection.';
    if (/timed? ?out|ETIMEDOUT|AbortError/i.test(msg)) return 'the server did not respond in time.';
    if (/\b404\b/.test(msg)) return 'no MCP endpoint at that address (404).';
    return msg.slice(0, 200);
}
