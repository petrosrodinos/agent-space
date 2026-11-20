import { createHmac, timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of two strings or buffers (false when lengths differ). */
export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const x = Buffer.isBuffer(a) ? a : Buffer.from(a, 'utf8');
    const y = Buffer.isBuffer(b) ? b : Buffer.from(b, 'utf8');
    return x.length === y.length && timingSafeEqual(x, y);
}

export const hmacSha256 = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();

/**
 * Standard Webhooks / Svix signatures (Composio, Resend): HMAC-SHA256 of "id.timestamp.body" with the base64 secret
 * after "whsec_", sent as space-separated "v1,<base64>" values. Also checks the timestamp is recent.
 */
export function verifyStandardWebhook(input: { secret: string; id?: string; timestamp?: string; signature?: string; body: string; maxAgeSeconds: number; now?: number }): boolean {
    const { secret, id, timestamp, signature, body } = input;
    if (!id || !timestamp || !signature) return false;
    const now = input.now ?? Date.now() / 1000;
    if (!Number.isFinite(Number(timestamp)) || Math.abs(now - Number(timestamp)) > input.maxAgeSeconds) return false;
    const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : Buffer.from(secret, 'utf8');
    const expected = hmacSha256(key, `${id}.${timestamp}.${body}`);
    return signature.split(' ').some((part) => {
        const value = part.split(',')[1];
        return !!value && safeEqual(Buffer.from(value, 'base64'), expected);
    });
}

/** Slack request signing: "v0=" + hex HMAC-SHA256 of "v0:<timestamp>:<body>" with the signing secret. */
export function verifySlackSignature(input: { secret: string; timestamp?: string; signature?: string; body: string; maxAgeSeconds: number; now?: number }): boolean {
    const { secret, timestamp, signature, body } = input;
    if (!timestamp || !signature) return false;
    const now = input.now ?? Date.now() / 1000;
    if (!Number.isFinite(Number(timestamp)) || Math.abs(now - Number(timestamp)) > input.maxAgeSeconds) return false;
    return safeEqual(signature, `v0=${hmacSha256(secret, `v0:${timestamp}:${body}`).toString('hex')}`);
}

/** Meta (WhatsApp Cloud API) webhooks: "sha256=" + hex HMAC-SHA256 of the raw body with the app secret. */
export function verifyMetaSignature(input: { secret: string; signature?: string; body: string }): boolean {
    if (!input.signature) return false;
    return safeEqual(input.signature, `sha256=${hmacSha256(input.secret, input.body).toString('hex')}`);
}
