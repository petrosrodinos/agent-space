import { htmlTitle, htmlToText } from '@/shared/utils/files/html-to-text.utils';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

function isPrivate(ip: string) {
    if (isIP(ip) === 6) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip.startsWith('::ffff:127.');
    return PRIVATE_V4.some((r) => r.test(ip));
}

/** Blocks requests to internal networks (SSRF) — bots may only read public web pages. */
export async function assertPublicUrl(raw: string): Promise<URL> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Invalid URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https links can be opened');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|metadata\.google\.internal)$/i.test(host) || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('That address is not allowed');
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.some((a) => isPrivate(a.address))) throw new Error('That address is not allowed');
    return url;
}

/** Fetches a public page and turns it into readable text (title + main text, links kept inline). */
export async function fetchReadable(raw: string, maxChars = 20000) {
    const url = await assertPublicUrl(raw);
    const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentSpaceBot/1.0)', Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5' },
        signal: AbortSignal.timeout(20_000),
    });
    const type = res.headers.get('content-type') ?? '';
    const body = (await res.text()).slice(0, 2_000_000);
    if (!res.ok) throw new Error(`The page returned ${res.status}`);
    if (!/html/i.test(type)) return { url: res.url, title: null, status: res.status, text: body.slice(0, maxChars) };
    const title = htmlTitle(body);
    const text = htmlToText(body);
    return { url: res.url, title, status: res.status, text: text.slice(0, maxChars) };
}
