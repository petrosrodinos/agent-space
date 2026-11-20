import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalChannel } from 'generated/prisma';
import { verifyMetaSignature, verifySlackSignature, verifyStandardWebhook } from '@/shared/utils/security/webhook-signature.utils';
import { CHANNEL_REQUIRED_ENV, ChannelEnv, ChannelMeta, InboundMessage, MAX_INBOUND_CHARS, WEBHOOK_MAX_AGE_SECONDS } from './channels.constants';

type Headers = Record<string, string | string[] | undefined>;
const header = (h: Headers, k: string) => {
    const v = h[k];
    return Array.isArray(v) ? v[0] : v;
};
const TIMEOUT_MS = 15_000;

/** "Name <a@b.com>" → "a@b.com" (lower case). */
export function emailAddressOf(raw: string): string {
    const m = /<([^>]+)>/.exec(raw);
    return (m ? m[1] : raw).trim().toLowerCase();
}

/** Drops the quoted earlier conversation from an email reply ("On … wrote:", "> …", "-----Original Message-----"). */
export function stripQuotedEmail(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    for (const line of lines) {
        const t = line.trim();
        if (/^On .+wrote:\s*$/i.test(t) || /^-{2,}\s*Original Message\s*-{2,}/i.test(t) || (/^From: .+/i.test(t) && out.length > 0)) break;
        if (line.startsWith('>')) continue;
        out.push(line);
    }
    return out.join('\n').trim();
}

/** Slack mrkdwn: **bold** → *bold*, [label](url) → <url|label>. */
export function toSlackText(markdown: string): string {
    return markdown.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<$2|$1>');
}

/** WhatsApp formatting: **bold** → *bold*, [label](url) → label (url). */
export function toWhatsAppText(markdown: string): string {
    return markdown.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The provider side of "Message from anywhere" (§16): checks webhook signatures, turns deliveries into inbound
 * messages, and sends replies (Resend, Slack Web API, WhatsApp Cloud API).
 */
@Injectable()
export class ChannelTransportService {
    private readonly logger = new Logger(ChannelTransportService.name);

    constructor(private readonly config: ConfigService) { }

    private env(name: string) {
        return this.config.get<string>(name) || '';
    }

    available(channel: ExternalChannel): boolean {
        return CHANNEL_REQUIRED_ENV[channel].every((k) => !!this.env(k));
    }

    private require(channel: ExternalChannel) {
        if (!this.available(channel)) throw new ServiceUnavailableException(`${channel.toLowerCase()} messaging is not set up`);
    }

    get inboundDomain() {
        return this.env(ChannelEnv.INBOUND_EMAIL_DOMAIN).toLowerCase();
    }

    get whatsappNumber() {
        return this.env(ChannelEnv.WHATSAPP_DISPLAY_NUMBER) || null;
    }

    // ---------------- Email (Resend inbound) ----------------

    /** Verifies an `email.received` delivery (Svix headers) and returns the email's id and recipients, or null for other events. */
    verifyEmail(headers: Headers, raw: Buffer | undefined): { delivery_id: string; email_id: string; to: string[]; from: string; subject: string | null; message_id: string | null } | null {
        this.require(ExternalChannel.EMAIL);
        const body = raw?.toString('utf8') ?? '';
        const ok = verifyStandardWebhook({
            secret: this.env(ChannelEnv.RESEND_INBOUND_WEBHOOK_SECRET),
            id: header(headers, 'svix-id'),
            timestamp: header(headers, 'svix-timestamp'),
            signature: header(headers, 'svix-signature'),
            body,
            maxAgeSeconds: WEBHOOK_MAX_AGE_SECONDS,
        });
        if (!ok) throw new UnauthorizedException('Bad webhook signature');
        const evt = JSON.parse(body) as { type?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string; message_id?: string } };
        if (evt.type !== 'email.received' || !evt.data?.email_id) return null;
        return {
            delivery_id: header(headers, 'svix-id')!,
            email_id: evt.data.email_id,
            to: (evt.data.to ?? []).map(emailAddressOf),
            from: emailAddressOf(evt.data.from ?? ''),
            subject: evt.data.subject ?? null,
            message_id: evt.data.message_id ?? null,
        };
    }

    /** Reads a received email's text (the webhook carries metadata only) and its sender checks. */
    async fetchEmail(emailId: string): Promise<{ text: string; spf: string | null; dkim: string | null; dmarc: string | null }> {
        const base = this.env(ChannelEnv.RESEND_API_URL) || 'https://api.resend.com';
        const res = await fetch(`${base}/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${this.env('RESEND_API_KEY')}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`Resend answered ${res.status} for the received email`);
        const e = (await res.json()) as { text?: string | null; html?: string | null; authentication?: Record<string, unknown> | null };
        const text = e.text ?? (e.html ? e.html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '');
        const verdict = (k: string) => {
            const v = e.authentication?.[k];
            if (v == null) return null;
            return String(typeof v === 'object' ? ((v as Record<string, unknown>).result ?? (v as Record<string, unknown>).status ?? '') : v).toLowerCase() || null;
        };
        return { text: stripQuotedEmail(text).slice(0, MAX_INBOUND_CHARS), spf: verdict('spf'), dkim: verdict('dkim'), dmarc: verdict('dmarc') };
    }

    private async sendEmail(meta: ChannelMeta, text: string, botName: string) {
        const subject = meta.email_subject ? (/^re:/i.test(meta.email_subject) ? meta.email_subject : `Re: ${meta.email_subject}`) : `Message from ${botName}`;
        const headers: Record<string, string> = {};
        if (meta.email_message_id) {
            headers['In-Reply-To'] = meta.email_message_id;
            headers['References'] = meta.email_message_id;
        }
        const html = `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>`;
        const base = this.env(ChannelEnv.RESEND_API_URL) || 'https://api.resend.com';
        // Sent from the member's personal address so replying continues the same conversation.
        const res = await fetch(`${base}/emails`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: `${botName.replace(/[<>"]/g, '')} via Agent Space <${meta.email_to}>`, to: [meta.email_from_address], subject, text, html, headers }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    // ---------------- Slack (Events API) ----------------

    /** Verifies a Slack request. Returns the url_verification challenge, a direct message, or nothing to do. */
    verifySlack(headers: Headers, raw: Buffer | undefined): { challenge?: string; message?: InboundMessage } {
        this.require(ExternalChannel.SLACK);
        const body = raw?.toString('utf8') ?? '';
        const ok = verifySlackSignature({ secret: this.env(ChannelEnv.SLACK_SIGNING_SECRET), timestamp: header(headers, 'x-slack-request-timestamp'), signature: header(headers, 'x-slack-signature'), body, maxAgeSeconds: WEBHOOK_MAX_AGE_SECONDS });
        if (!ok) throw new UnauthorizedException('Bad Slack signature');
        const p = JSON.parse(body) as { type?: string; challenge?: string; event_id?: string; team_id?: string; event?: { type?: string; channel_type?: string; user?: string; bot_id?: string; subtype?: string; text?: string; channel?: string; ts?: string; thread_ts?: string } };
        if (p.type === 'url_verification') return { challenge: p.challenge };
        const e = p.event;
        // Only people's own direct messages to the app; never the app's own messages or edits.
        if (p.type !== 'event_callback' || !e || e.type !== 'message' || e.channel_type !== 'im' || e.bot_id || e.subtype || !e.user || !e.text?.trim()) return {};
        return {
            message: {
                channel: ExternalChannel.SLACK,
                delivery_id: p.event_id ?? `${e.channel}:${e.ts}`,
                external_id: `${p.team_id}:${e.user}`,
                text: e.text.slice(0, MAX_INBOUND_CHARS),
                meta: { slack_channel: e.channel, slack_thread_ts: e.thread_ts ?? e.ts },
            },
        };
    }

    private async sendSlack(meta: { slack_channel?: string; slack_thread_ts?: string }, text: string) {
        const base = this.env(ChannelEnv.SLACK_API_URL) || 'https://slack.com/api';
        const res = await fetch(`${base}/chat.postMessage`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.env(ChannelEnv.SLACK_BOT_TOKEN)}`, 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ channel: meta.slack_channel, thread_ts: meta.slack_thread_ts, text: toSlackText(text), unfurl_links: false }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const r = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !r.ok) throw new Error(`Slack answered ${r.error ?? res.status}`);
    }

    // ---------------- WhatsApp (Cloud API) ----------------

    /** Meta's subscription check: echoes the challenge when the verify token matches. */
    verifyWhatsAppSubscription(mode?: string, token?: string, challenge?: string): string {
        this.require(ExternalChannel.WHATSAPP);
        if (mode !== 'subscribe' || !token || token !== this.env(ChannelEnv.WHATSAPP_VERIFY_TOKEN) || !challenge) throw new UnauthorizedException('Bad verify token');
        return challenge;
    }

    /** Verifies a WhatsApp delivery and returns its text messages (other kinds get a short "text only" reply). */
    verifyWhatsApp(headers: Headers, raw: Buffer | undefined): { messages: InboundMessage[]; unsupported: string[] } {
        this.require(ExternalChannel.WHATSAPP);
        const body = raw?.toString('utf8') ?? '';
        if (!verifyMetaSignature({ secret: this.env(ChannelEnv.WHATSAPP_APP_SECRET), signature: header(headers, 'x-hub-signature-256'), body })) throw new UnauthorizedException('Bad WhatsApp signature');
        const p = JSON.parse(body) as { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: { id: string; from: string; type: string; text?: { body?: string } }[] } }[] }[] };
        const messages: InboundMessage[] = [];
        const unsupported: string[] = [];
        for (const entry of p.entry ?? []) {
            for (const change of entry.changes ?? []) {
                const v = change.value;
                // Only our own number's messages.
                if (v?.metadata?.phone_number_id && v.metadata.phone_number_id !== this.env(ChannelEnv.WHATSAPP_PHONE_NUMBER_ID)) continue;
                for (const m of v?.messages ?? []) {
                    const from = m.from.replace(/\D/g, '');
                    if (m.type !== 'text' || !m.text?.body?.trim()) {
                        unsupported.push(from);
                        continue;
                    }
                    messages.push({ channel: ExternalChannel.WHATSAPP, delivery_id: m.id, external_id: from, text: m.text.body.slice(0, MAX_INBOUND_CHARS), meta: { whatsapp_to: from } });
                }
            }
        }
        return { messages, unsupported };
    }

    private async sendWhatsApp(to: string, text: string) {
        const base = this.env(ChannelEnv.WHATSAPP_API_URL) || 'https://graph.facebook.com/v21.0';
        const res = await fetch(`${base}/${encodeURIComponent(this.env(ChannelEnv.WHATSAPP_PHONE_NUMBER_ID))}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.env(ChannelEnv.WHATSAPP_ACCESS_TOKEN)}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: toWhatsAppText(text) } }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`WhatsApp answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    // ---------------- Sending ----------------

    async send(meta: ChannelMeta, text: string, botName: string) {
        if (!this.available(meta.channel)) throw new Error(`${meta.channel} is not set up`);
        switch (meta.channel) {
            case ExternalChannel.EMAIL:
                return this.sendEmail(meta, text, botName);
            case ExternalChannel.SLACK:
                return this.sendSlack(meta, text);
            case ExternalChannel.WHATSAPP:
                if (!meta.whatsapp_to) throw new BadRequestException('No WhatsApp number');
                return this.sendWhatsApp(meta.whatsapp_to, text);
        }
    }

    /** A notice outside a linked conversation (linking confirmations, "not linked" hints). Email is never used for these. */
    async notice(channel: ExternalChannel, meta: InboundMessage['meta'], text: string) {
        try {
            if (channel === ExternalChannel.SLACK) await this.sendSlack(meta, text);
            else if (channel === ExternalChannel.WHATSAPP && meta.whatsapp_to) await this.sendWhatsApp(meta.whatsapp_to, text);
        } catch (e) {
            this.logger.warn(`${channel} notice failed: ${(e as Error).message}`);
        }
    }
}
