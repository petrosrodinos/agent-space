import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostMatchesDomain, parseTotpSecret } from '@/shared/utils/security/website-login.utils';

/** A login found in the password manager for one website. Values go straight to the sign-in helper, never to a bot. */
export interface PasswordManagerLogin {
    item_title: string;
    username: string | null;
    password: string | null;
    totp_secret: string | null;
}

interface ConnectItemSummary {
    id: string;
    title: string;
    category?: string;
    urls?: { href: string; primary?: boolean }[];
    vault: { id: string };
}

interface ConnectField {
    id: string;
    type?: string;
    purpose?: string;
    label?: string;
    value?: string;
    totp?: string;
}

const LOCAL_ENVS = ['local', 'staging', 'test'];
const TIMEOUT_MS = 15_000;

/**
 * 1Password Connect (§16 Password manager connection): the organisation runs a Connect server; we read login items
 * for one website at sign-in time with its access token. Nothing is cached and nothing is returned to the model.
 */
@Injectable()
export class OnePasswordConnectService {
    private readonly logger = new Logger(OnePasswordConnectService.name);

    constructor(private readonly config: ConfigService) { }

    /** Connect servers must be https on a public address; http://localhost is allowed outside production for testing. */
    normalizeServerUrl(raw: string): string {
        let u: URL;
        try {
            u = new URL(raw.trim());
        } catch {
            throw new BadRequestException('Enter the address of your 1Password Connect server, e.g. https://op-connect.acme.com');
        }
        const local = ['localhost', '127.0.0.1'].includes(u.hostname);
        const env = String(this.config.get('NODE_ENV') ?? '');
        if (local && !LOCAL_ENVS.includes(env)) throw new BadRequestException('Use the public https address of your Connect server');
        if (!local && u.protocol !== 'https:') throw new BadRequestException('The Connect server address must start with https://');
        if (!local && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(u.hostname)) throw new BadRequestException('Use the public address of your Connect server');
        return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
    }

    private async get<T>(base: string, token: string, path: string): Promise<T> {
        const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 401 || res.status === 403) throw new BadRequestException('1Password rejected the access token');
        if (!res.ok) throw new BadRequestException(`1Password Connect answered ${res.status}`);
        return (await res.json()) as T;
    }

    /** Checks the server and token work; returns how many vaults the token can read. */
    async test(base: string, token: string): Promise<{ vaults: number }> {
        const vaults = await this.get<{ id: string }[]>(base, token, '/v1/vaults');
        return { vaults: vaults.length };
    }

    /** The login item for a website: its URL must match the website (or a subdomain). Prefers the primary URL match. */
    async findLogin(base: string, token: string, website: string): Promise<PasswordManagerLogin | null> {
        const vaults = await this.get<{ id: string }[]>(base, token, '/v1/vaults');
        let best: ConnectItemSummary | null = null;
        for (const v of vaults.slice(0, 20)) {
            const items = await this.get<ConnectItemSummary[]>(base, token, `/v1/vaults/${encodeURIComponent(v.id)}/items`);
            for (const it of items) {
                if (it.category && it.category !== 'LOGIN') continue;
                const hosts = (it.urls ?? []).map((x) => {
                    try {
                        return new URL(x.href.includes('://') ? x.href : `https://${x.href}`).hostname;
                    } catch {
                        return '';
                    }
                });
                // The item's website must cover the open site (same host or a parent domain), never the other way round.
                if (hosts.some((h) => h && hostMatchesDomain(website, h))) {
                    best = it;
                    if ((it.urls ?? []).some((x) => x.primary)) break;
                }
            }
            if (best) break;
        }
        if (!best) return null;
        const item = await this.get<{ title: string; fields?: ConnectField[] }>(base, token, `/v1/vaults/${encodeURIComponent(best.vault.id)}/items/${encodeURIComponent(best.id)}`);
        const fields = item.fields ?? [];
        const byPurpose = (p: string) => fields.find((f) => f.purpose === p)?.value ?? null;
        const otp = fields.find((f) => f.type === 'OTP');
        return {
            item_title: item.title,
            username: byPurpose('USERNAME'),
            password: byPurpose('PASSWORD'),
            totp_secret: otp?.value ? parseTotpSecret(otp.value) : null,
        };
    }
}
