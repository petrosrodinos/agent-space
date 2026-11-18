import { createHmac } from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Normalises what a user typed as a login's website ("https://www.Portal.acme.com/login") to a bare host
 * ("portal.acme.com"). Returns null when it isn't a plausible public host name.
 */
export function normalizeWebsiteDomain(input: string): string | null {
    let raw = input.trim().toLowerCase();
    if (!raw) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = `https://${raw}`;
    let host: string;
    try {
        host = new URL(raw).hostname;
    } catch {
        return null;
    }
    host = host.replace(/^www\./, '').replace(/\.$/, '');
    if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
    return host;
}

/** A login saved for "acme.com" may be typed on acme.com and its subdomains, never on look-alikes ("acme.com.evil.io"). */
export function hostMatchesDomain(host: string, domain: string): boolean {
    const h = host.toLowerCase().replace(/\.$/, '');
    const d = domain.toLowerCase();
    return h === d || h.endsWith(`.${d}`);
}

function base32Decode(secret: string): Buffer {
    const clean = secret.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = BASE32.indexOf(ch);
        if (idx < 0) throw new Error('The two-step secret is not valid base32');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** Accepts a raw base32 secret or an otpauth:// URI (as shown under authenticator QR codes) and returns the base32 secret. */
export function parseTotpSecret(input: string): string | null {
    const v = input.trim();
    if (!v) return null;
    let secret = v;
    if (/^otpauth:\/\//i.test(v)) {
        try {
            secret = new URL(v).searchParams.get('secret') ?? '';
        } catch {
            return null;
        }
    }
    secret = secret.toUpperCase().replace(/[\s=-]/g, '');
    if (secret.length < 16 || !/^[A-Z2-7]+$/.test(secret)) return null;
    return secret;
}

/** RFC 6238 time-based one-time code (SHA-1, 30 s, 6 digits — what authenticator apps use). */
export function totpCode(secret: string, now = Date.now(), step = 30, digits = 6): string {
    const counter = Math.floor(now / 1000 / step);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(bin % 10 ** digits).padStart(digits, '0');
}

/** "petros@acme.com" → "pe…@acme.com", "jsmith" → "js…h": enough to recognise the account, not to read it out. */
export function maskUsername(username: string): string {
    const u = username.trim();
    const at = u.indexOf('@');
    if (at > 0) return `${u.slice(0, Math.min(2, at))}…${u.slice(at)}`;
    return u.length <= 3 ? `${u[0] ?? ''}…` : `${u.slice(0, 2)}…${u.slice(-1)}`;
}
