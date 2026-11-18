/**
 * Client-side secret detection before sending (§8.8). Same rules as api/src/shared/utils/security/secret-detection.utils.ts:
 * known key prefixes, plus high-entropy strings next to words like "key", "token" or "password".
 */
const KNOWN_PATTERNS: RegExp[] = [
  /\bsk-(?:proj-|ant-|or-v1-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g,
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b[a-f0-9]{32}-us\d{1,2}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{36}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
];
const CONTEXT_WORDS = /\b(api[_\s-]?key|key|token|secret|password|passwd|pwd|bearer|credential|access[_\s-]?key)\b/i;
const CANDIDATE = /[A-Za-z0-9_\-+/=.]{20,}/g;

function entropy(s: string) {
  const f = new Map<string, number>();
  for (const c of s) f.set(c, (f.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of f.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function looksRandom(s: string) {
  if (/^[a-z]+$/i.test(s) || /^\d+$/.test(s) || /^https?:/i.test(s)) return false;
  return [/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(s)).length >= 2 && entropy(s) >= 3.5;
}

export interface FoundSecret {
  value: string;
  index: number;
}

export function findSecrets(text: string): FoundSecret[] {
  const found = new Map<number, FoundSecret>();
  for (const re of KNOWN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) found.set(m.index, { value: m[0], index: m.index });
  }
  if (CONTEXT_WORDS.test(text)) {
    CANDIDATE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CANDIDATE.exec(text))) {
      const idx = m.index;
      const overlaps = [...found.values()].some((f) => idx >= f.index && idx < f.index + f.value.length);
      if (!overlaps && looksRandom(m[0])) found.set(idx, { value: m[0], index: idx });
    }
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

/** Removes the secrets from the text (for "Store securely": the rest of the message is sent as normal). */
export function stripSecrets(text: string, secrets: FoundSecret[]) {
  let out = text;
  for (const s of [...secrets].reverse()) out = out.slice(0, s.index) + "[secret stored securely]" + out.slice(s.index + s.value.length);
  return out;
}

export function guessService(text: string, secret: string): string {
  if (/^sk-ant-/.test(secret)) return "Anthropic";
  if (/^sk-or-/.test(secret)) return "OpenRouter";
  if (/^sk-/.test(secret)) return "OpenAI";
  if (/^gh|^github_pat_/.test(secret)) return "GitHub";
  if (/^xox/.test(secret)) return "Slack";
  if (/^(sk|rk|pk)_(live|test)_/.test(secret)) return "Stripe";
  if (/^AKIA/.test(secret)) return "AWS";
  if (/^AIza/.test(secret)) return "Google";
  if (/-us\d+$/.test(secret)) return "Mailchimp";
  if (/^SG\./.test(secret)) return "SendGrid";
  const named = /\b(mailchimp|stripe|github|slack|openai|hubspot|notion|airtable|sendgrid|twilio|zendesk|shopify|openweather)\b/i.exec(text);
  return named ? named[1].replace(/^\w/, (c) => c.toUpperCase()) : "";
}
