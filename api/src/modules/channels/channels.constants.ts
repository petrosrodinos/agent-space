import { ExternalChannel } from 'generated/prisma';

/** Environment variables per channel (§16 Message from anywhere). A channel is offered only when its variables are set. */
export const ChannelEnv = {
    /** Domain whose inbound mail Resend receives (MX record), e.g. "in.agentspace.app" or "<id>.resend.app". */
    INBOUND_EMAIL_DOMAIN: 'INBOUND_EMAIL_DOMAIN',
    /** Signing secret of the Resend "email.received" webhook (whsec_…). */
    RESEND_INBOUND_WEBHOOK_SECRET: 'RESEND_INBOUND_WEBHOOK_SECRET',
    SLACK_SIGNING_SECRET: 'SLACK_SIGNING_SECRET',
    /** Bot token (xoxb-…) of the Agent Space Slack app, with chat:write and im:history. */
    SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
    /** Meta app secret (signs webhook deliveries). */
    WHATSAPP_APP_SECRET: 'WHATSAPP_APP_SECRET',
    /** Any string; Meta sends it back when the webhook is registered. */
    WHATSAPP_VERIFY_TOKEN: 'WHATSAPP_VERIFY_TOKEN',
    WHATSAPP_ACCESS_TOKEN: 'WHATSAPP_ACCESS_TOKEN',
    WHATSAPP_PHONE_NUMBER_ID: 'WHATSAPP_PHONE_NUMBER_ID',
    /** The number members message, shown in Settings (e.g. "+30 21 0000 0000"). Optional. */
    WHATSAPP_DISPLAY_NUMBER: 'WHATSAPP_DISPLAY_NUMBER',
    /** Overrides for tests (mock servers). */
    SLACK_API_URL: 'SLACK_API_URL',
    WHATSAPP_API_URL: 'WHATSAPP_API_URL',
    RESEND_API_URL: 'RESEND_API_URL',
} as const;

export const CHANNEL_REQUIRED_ENV: Record<ExternalChannel, string[]> = {
    EMAIL: [ChannelEnv.INBOUND_EMAIL_DOMAIN, ChannelEnv.RESEND_INBOUND_WEBHOOK_SECRET, 'RESEND_API_KEY'],
    SLACK: [ChannelEnv.SLACK_SIGNING_SECRET, ChannelEnv.SLACK_BOT_TOKEN],
    WHATSAPP: [ChannelEnv.WHATSAPP_APP_SECRET, ChannelEnv.WHATSAPP_VERIFY_TOKEN, ChannelEnv.WHATSAPP_ACCESS_TOKEN, ChannelEnv.WHATSAPP_PHONE_NUMBER_ID],
};

export const CHANNEL_LABELS: Record<ExternalChannel, string> = { EMAIL: 'Email', SLACK: 'Slack', WHATSAPP: 'WhatsApp' };

/** Webhook deliveries older than this are refused; ids are remembered this long to ignore retries. */
export const WEBHOOK_MAX_AGE_SECONDS = 5 * 60;
export const WEBHOOK_DEDUPE_SECONDS = 24 * 3600;
/** Linking codes: 6 digits, valid 15 minutes. */
export const LINK_CODE_TTL_MS = 15 * 60_000;
/** Messages one link may send per hour before further messages are ignored (with one notice). */
export const CHANNEL_MESSAGES_PER_HOUR = 60;
/** Longest reply per channel (Slack text blocks, WhatsApp text messages). Email is not cut. */
export const REPLY_MAX_CHARS: Record<ExternalChannel, number> = { EMAIL: 100_000, SLACK: 3500, WHATSAPP: 4000 };
export const MAX_INBOUND_CHARS = 8000;

/** Run statuses that send something back to the channel. */
export const ReplyStatuses = { COMPLETED: 'COMPLETED', FAILED: 'FAILED', WAITING_APPROVAL: 'WAITING_APPROVAL', WAITING_INPUT: 'WAITING_INPUT' } as const;
export type ReplyStatus = (typeof ReplyStatuses)[keyof typeof ReplyStatuses];

/** Where a channel message came from: kept on the message as `channel_meta` so the reply goes back to the same place. */
export interface ChannelMeta {
    channel: ExternalChannel;
    link_id: string;
    /** Email: Message-ID and subject of the member's email. */
    email_message_id?: string | null;
    email_subject?: string | null;
    email_to?: string;
    email_from_address?: string;
    /** Slack: DM channel and the thread to answer in. */
    slack_channel?: string;
    slack_thread_ts?: string;
    /** WhatsApp: the member's number. */
    whatsapp_to?: string;
}

/** An inbound message after verification, before it's matched to a link. */
export interface InboundMessage {
    channel: ExternalChannel;
    /** Dedupe key from the provider (event / message id). */
    delivery_id: string;
    /** Slack "<team>:<user>", WhatsApp digits; email: the recipient token. */
    external_id: string;
    text: string;
    /** Email only: the sender address (checked against the member's account email). */
    from_address?: string;
    meta: Omit<ChannelMeta, 'link_id' | 'channel'>;
}

export interface ChannelJob {
    kind: 'inbound' | 'reply';
    inbound?: InboundMessage;
    run_id?: string;
    status?: ReplyStatus;
}
