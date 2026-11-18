/**
 * Shared secret-detection rules (§8.8): known key prefixes plus entropy checks next to words like
 * "key", "token" or "password". The same list is mirrored in the app (app/src/lib/secret-detection.ts).
 */

const KNOWN_PATTERNS: RegExp[] = [
    /\bsk-(?:proj-|ant-|or-v1-)?[A-Za-z0-9_\-]{20,}\b/g, // OpenAI / Anthropic / OpenRouter
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, // GitHub
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
    /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key
    /\bAIza[0-9A-Za-z_\-]{35}\b/g, // Google API key
    /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe
    /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g, // Resend
    /\bSG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g, // SendGrid
    /\b[a-f0-9]{32}-us\d{1,2}\b/g, // Mailchimp
    /\bglpat-[A-Za-z0-9_\-]{20,}\b/g, // GitLab
    /\bnpm_[A-Za-z0-9]{36}\b/g,
    /\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g, // JWT
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
];

const CONTEXT_WORDS = /\b(api[_\s-]?key|key|token|secret|password|passwd|pwd|bearer|credential|access[_\s-]?key)\b/i;
const CANDIDATE = /[A-Za-z0-9_\-+/=.]{20,}/g;

function shannonEntropy(s: string): number {
    const freq = new Map<string, number>();
    for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    let h = 0;
    for (const n of freq.values()) {
        const p = n / s.length;
        h -= p * Math.log2(p);
    }
    return h;
}

function looksRandom(s: string): boolean {
    if (/^[a-z]+$/i.test(s) || /^\d+$/.test(s)) return false;
    if (/^https?:/i.test(s)) return false;
    const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(s)).length;
    return classes >= 2 && shannonEntropy(s) >= 3.5;
}

export interface SecretMatch {
    value: string;
    index: number;
}

export function findSecrets(text: string): SecretMatch[] {
    if (!text) return [];
    const found = new Map<number, SecretMatch>();
    for (const re of KNOWN_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) found.set(m.index, { value: m[0], index: m.index });
    }
    if (CONTEXT_WORDS.test(text)) {
        CANDIDATE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CANDIDATE.exec(text))) {
            const overlapped = [...found.values()].some((f) => m!.index >= f.index && m!.index < f.index + f.value.length);
            if (!overlapped && looksRandom(m[0])) found.set(m.index, { value: m[0], index: m.index });
        }
    }
    return [...found.values()].sort((a, b) => a.index - b.index);
}

/** "sk-…a9f2" style mask (§8.5). */
export function maskSecret(value: string): string {
    const v = value.trim();
    const prefix = /^([A-Za-z]{2,6}[_-])/.exec(v)?.[1] ?? '';
    return `${prefix}…${v.slice(-4)}`;
}

export function maskSecretsInText(text: string): { text: string; masked: boolean } {
    const matches = findSecrets(text);
    if (!matches.length) return { text, masked: false };
    let out = text;
    for (const m of [...matches].reverse()) {
        out = out.slice(0, m.index) + maskSecret(m.value) + out.slice(m.index + m.value.length);
    }
    return { text: out, masked: true };
}

/** §8.7 Redaction: replace the values of secrets used in a call with `[secret]` before anything reaches the model or logs. */
export function redactValues<T>(input: T, secrets: string[]): T {
    const values = secrets.filter((s) => s && s.length >= 6);
    if (!values.length) return input;
    const json = JSON.stringify(input);
    if (json === undefined) return input;
    let out = json;
    for (const v of values) {
        const escaped = JSON.stringify(v).slice(1, -1);
        out = out.split(escaped).join('[secret]');
    }
    return JSON.parse(out) as T;
}
