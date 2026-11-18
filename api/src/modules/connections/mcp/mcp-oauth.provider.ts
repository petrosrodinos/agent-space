import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';

/** Everything the standard MCP sign-in needs to remember for one tool server. Kept in the secret store, never in the DB. */
export interface McpOAuthData {
    client_information?: OAuthClientInformationMixed;
    tokens?: OAuthTokens;
    /** Only while a sign-in is in progress (held in Redis, not the secret store). */
    code_verifier?: string;
}

/**
 * OAuthClientProvider for the MCP SDK (dynamic client registration + PKCE + refresh).
 * The SDK calls `saveTokens` after sign-in and after every refresh; `persist` writes the new state.
 * `redirectToAuthorization` only captures the URL — the app opens it for the user.
 */
export class McpOAuthProvider implements OAuthClientProvider {
    authorizationUrl?: URL;

    constructor(
        public data: McpOAuthData,
        private readonly redirect: string,
        private readonly persist: (data: McpOAuthData) => Promise<void>,
        private readonly stateValue?: string,
    ) { }

    get redirectUrl() {
        return this.redirect;
    }

    get clientMetadata(): OAuthClientMetadata {
        return {
            client_name: 'Agent Space',
            redirect_uris: [this.redirect],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        };
    }

    state() {
        return this.stateValue ?? '';
    }

    clientInformation() {
        return this.data.client_information;
    }

    async saveClientInformation(info: OAuthClientInformationMixed) {
        this.data.client_information = info;
        await this.persist(this.data);
    }

    tokens() {
        return this.data.tokens;
    }

    async saveTokens(tokens: OAuthTokens) {
        this.data.tokens = tokens;
        await this.persist(this.data);
    }

    redirectToAuthorization(url: URL) {
        this.authorizationUrl = url;
    }

    async saveCodeVerifier(v: string) {
        this.data.code_verifier = v;
        await this.persist(this.data);
    }

    codeVerifier() {
        if (!this.data.code_verifier) throw new Error('The sign-in expired. Start it again.');
        return this.data.code_verifier;
    }

    async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery') {
        if (scope === 'all' || scope === 'tokens') this.data.tokens = undefined;
        if (scope === 'all' || scope === 'client') this.data.client_information = undefined;
        if (scope === 'all' || scope === 'verifier') this.data.code_verifier = undefined;
        await this.persist(this.data);
    }
}
