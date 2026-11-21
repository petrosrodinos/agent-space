import { assertPublicUrl } from '../../agent/tools/web.utils';

const FETCH_TIMEOUT_MS = 10_000;
const WellKnown = {
    PROTECTED_RESOURCE: '/.well-known/oauth-protected-resource',
    AUTHORIZATION_SERVER: '/.well-known/oauth-authorization-server',
    OPENID: '/.well-known/openid-configuration',
} as const;

/** Thrown when the server's sign-in can't be used by Composio (it needs dynamic client registration). */
export class OAuthDiscoveryError extends Error { }

/** GETs a public JSON document; anything else (redirects, errors, private addresses) counts as "not there". */
async function getJson(url: string): Promise<Record<string, any> | null> {
    try {
        await assertPublicUrl(url);
        const res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) return null;
        const body = await res.json();
        return body && typeof body === 'object' ? body : null;
    } catch {
        return null;
    }
}

/** RFC 8414 / OIDC paths for an issuer, path-inserted form first (e.g. https://a.com/.well-known/…/tenant). */
function metadataCandidates(issuer: URL) {
    const path = issuer.pathname.replace(/\/$/, '');
    const out = [`${issuer.origin}${WellKnown.AUTHORIZATION_SERVER}${path}`, `${issuer.origin}${WellKnown.OPENID}${path}`, `${issuer.origin}${path}${WellKnown.OPENID}`];
    if (path) out.push(`${issuer.origin}${WellKnown.AUTHORIZATION_SERVER}`, `${issuer.origin}${WellKnown.OPENID}`);
    return [...new Set(out)];
}

/**
 * Finds the OAuth authorization-server metadata URL of an MCP server (§8.4), the way MCP clients do: the protected
 * resource metadata names the authorization server, otherwise the server's own origin is the issuer. Composio's custom
 * MCP sign-in needs it, and needs the server to allow dynamic client registration.
 */
export async function discoverOAuthMetadataUrl(mcpUrl: URL): Promise<string> {
    const path = mcpUrl.pathname.replace(/\/$/, '');
    const resource = (path && (await getJson(`${mcpUrl.origin}${WellKnown.PROTECTED_RESOURCE}${path}`))) || (await getJson(`${mcpUrl.origin}${WellKnown.PROTECTED_RESOURCE}`));
    const issuers: URL[] = [];
    for (const raw of (resource?.authorization_servers as unknown[]) ?? []) {
        try {
            issuers.push(new URL(String(raw)));
        } catch { /* skip malformed entries */ }
    }
    if (!issuers.length) issuers.push(new URL(mcpUrl.origin));

    let found = false;
    for (const issuer of issuers) {
        for (const candidate of metadataCandidates(issuer)) {
            const meta = await getJson(candidate);
            if (!meta?.authorization_endpoint || !meta?.token_endpoint) continue;
            found = true;
            if (meta.registration_endpoint) return candidate;
        }
    }
    throw new OAuthDiscoveryError(
        found
            ? "This server's sign-in doesn't allow apps to register themselves (dynamic client registration), so it can't be connected with \"Sign in\". Use an access token instead."
            : 'This server has no standard sign-in (no OAuth details were found). Choose "No sign-in" or "Access token" instead.',
    );
}
