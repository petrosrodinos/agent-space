import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";

/** Outside places a member can message their bot from (§16 Message from anywhere). */
export const ExternalChannels = { EMAIL: "EMAIL", SLACK: "SLACK", WHATSAPP: "WHATSAPP" } as const;
export type ExternalChannel = (typeof ExternalChannels)[keyof typeof ExternalChannels];

export const ChannelLinkStatuses = { PENDING: "PENDING", ACTIVE: "ACTIVE" } as const;
export type ChannelLinkStatus = (typeof ChannelLinkStatuses)[keyof typeof ChannelLinkStatuses];

export interface ChannelLink {
  id: string;
  channel: ExternalChannel;
  status: ChannelLinkStatus;
  bot: BotBrief;
  /** Email: the member's personal address; WhatsApp: the number to message. */
  address: string | null;
  /** Linked Slack user or masked phone number. */
  linked_as: string | null;
  /** Slack / WhatsApp while waiting to be linked. */
  link_code: string | null;
  link_code_expires_at: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ChannelsOverview {
  available: Record<ExternalChannel, boolean>;
  links: ChannelLink[];
}
