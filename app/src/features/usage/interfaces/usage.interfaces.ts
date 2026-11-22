export const UsageLimitScopes = { ORGANIZATION: "ORGANIZATION", MEMBER: "MEMBER", BOT: "BOT" } as const;
export type UsageLimitScope = (typeof UsageLimitScopes)[keyof typeof UsageLimitScopes];
export const UsageKinds = { MODEL_TOKENS: "MODEL_TOKENS", COMPUTER_MINUTES: "COMPUTER_MINUTES", VOICE_MINUTES: "VOICE_MINUTES", STORAGE_BYTES: "STORAGE_BYTES", ARTIFACT_AI: "ARTIFACT_AI" } as const;
export type UsageKind = (typeof UsageKinds)[keyof typeof UsageKinds];
export const ActorTypes = { USER: "USER", BOT: "BOT", SYSTEM: "SYSTEM" } as const;
export type ActorType = (typeof ActorTypes)[keyof typeof ActorTypes];

import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";

export interface UsageOverview {
  period: string;
  total_cost: number;
  by_kind: { kind: string; cost: number; quantity: number }[];
  by_member: { user: { id: string; name: string | null; email: string } | null; cost: number; tokens: number }[];
  by_bot: { bot: BotBrief | null; cost: number; tokens: number }[];
  by_model: { model: { id: string; name: string; provider: string } | null; cost: number; tokens: number }[];
  by_day: { day: string; cost: number }[];
  limits: { id: string; scope: UsageLimitScope; user_id: string | null; bot_id: string | null; monthly_limit: number }[];
}

export interface UsageCharge {
  id: string;
  kind: UsageKind;
  /** Tokens for model calls, minutes for voice and computers. */
  quantity: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number;
  run_id: string | null;
  created_at: string;
  user: { id: string; name: string | null; email: string } | null;
  bot: BotBrief | null;
  model: { id: string; name: string; provider: string } | null;
}

export interface UsageChargesFilters {
  page?: number;
  kind?: UsageKind;
  user_id?: string;
  bot_id?: string;
  model_id?: string;
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
}

export interface ActivityEntry {
  id: string;
  actor_type: ActorType;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_user: { id: string; name: string | null; email: string } | null;
  actor_bot: BotBrief | null;
  connection: { id: string; label: string } | null;
}
