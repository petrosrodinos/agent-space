import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";
import { type SecretKind } from "@/features/conversations/interfaces/conversations.interfaces";

export const ConnectionKinds = { COMPOSIO: "COMPOSIO", API_KEY: "API_KEY", MCP: "MCP" } as const;
export type ConnectionKind = (typeof ConnectionKinds)[keyof typeof ConnectionKinds];
export const Visibilities = { PRIVATE: "PRIVATE", SHARED: "SHARED" } as const;
export type Visibility = (typeof Visibilities)[keyof typeof Visibilities];
export const CredentialKinds = { API_KEY: "API_KEY", MCP_TOKEN: "MCP_TOKEN", MCP_OAUTH: "MCP_OAUTH", WEBSITE_LOGIN: "WEBSITE_LOGIN" } as const;
export type CredentialKind = (typeof CredentialKinds)[keyof typeof CredentialKinds];
export const ConnectionStatuses = { ACTIVE: "ACTIVE", NEEDS_RECONNECTING: "NEEDS_RECONNECTING", ERROR: "ERROR" } as const;
export type ConnectionStatus = (typeof ConnectionStatuses)[keyof typeof ConnectionStatuses];

export interface Toolkit {
  slug: string;
  name: string;
  logo: string | null;
  description: string | null;
  categories: string[];
  auth_schemes: string[];
  managed: boolean;
  tools_count: number;
  connected_count: number;
  allowed: boolean;
}

export interface Connection {
  id: string;
  kind: ConnectionKind;
  service_key: string;
  service_name: string;
  label: string;
  account_identifier: string | null;
  visibility: Visibility;
  status: ConnectionStatus;
  status_message: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  restricted_bots: BotBrief[];
  masked_hint: string | null;
  credential_id: string | null;
  is_default: boolean;
  last_used_at: string | null;
  created_at: string;
  can_manage: boolean;
}

export const CredentialStatuses = { ACTIVE: "ACTIVE", NOT_WORKING: "NOT_WORKING", EXPIRED: "EXPIRED", NEEDS_RECONNECTING: "NEEDS_RECONNECTING" } as const;
export type CredentialStatus = (typeof CredentialStatuses)[keyof typeof CredentialStatuses];

export interface Credential {
  id: string;
  label: string;
  service_key: string | null;
  service_name: string | null;
  kind: CredentialKind;
  masked_hint: string | null;
  /** Website logins only: the site (and subdomains) the bot may type it into. */
  website_domain: string | null;
  visibility: Visibility;
  status: CredentialStatus;
  expires_at: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  created_at: string;
  last_used_at: string | null;
  last_used_bot: BotBrief | null;
  bots: BotBrief[];
  connection_id: string | null;
  can_manage: boolean;
}

export interface CredentialEvent {
  id: string;
  type: "CREATED" | "REPLACED" | "RENAMED" | "SHARED" | "MADE_PRIVATE" | "BOTS_CHANGED" | "TESTED" | "USED" | "DELETED";
  action: string | null;
  created_at: string;
  user: { name: string | null; email: string } | null;
  bot: { id: string; name: string; emoji: string } | null;
}

export interface CreateCredentialDto {
  label: string;
  service_name?: string;
  kind: SecretKind;
  /** Key or token; for a website login, the password. */
  value: string;
  website?: string;
  username?: string;
  totp_secret?: string;
  visibility?: Visibility;
  bot_ids?: string[];
  request?: { run_id: string; request_id: string };
}

export interface ReplaceCredentialDto {
  value: string;
  /** Website logins: a new username (kept when omitted) and authenticator key ("" removes it). */
  username?: string;
  totp_secret?: string;
  request?: { run_id: string; request_id: string };
}

/** `status` query parameter Composio adds when it redirects back after sign-in. */
export const ProviderCallbackStatuses = { SUCCESS: "success", FAILED: "failed" } as const;
