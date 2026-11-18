export const UsageLimitScopes = { ORGANIZATION: "ORGANIZATION", MEMBER: "MEMBER", BOT: "BOT" } as const;
export type UsageLimitScope = (typeof UsageLimitScopes)[keyof typeof UsageLimitScopes];
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
