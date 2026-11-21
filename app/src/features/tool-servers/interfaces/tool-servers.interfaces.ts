import type { Visibility } from "@/features/connections/interfaces/connections.interfaces";

export const ToolServerAuthKinds = { NONE: "NONE", TOKEN: "TOKEN", OAUTH: "OAUTH" } as const;
export type ToolServerAuthKind = (typeof ToolServerAuthKinds)[keyof typeof ToolServerAuthKinds];
/** Same values as a connection's status: a tool server's status is its connection's. */
export const ToolServerStatuses = { ACTIVE: "ACTIVE", NEEDS_RECONNECTING: "NEEDS_RECONNECTING", ERROR: "ERROR" } as const;
export type ToolServerStatus = (typeof ToolServerStatuses)[keyof typeof ToolServerStatuses];

export interface ToolServer {
  id: string;
  name: string;
  url: string;
  auth_kind: ToolServerAuthKind;
  visibility: Visibility;
  status: ToolServerStatus;
  status_message: string | null;
  tool_count: number;
  last_listed_at: string | null;
  /** The connected-service key (Composio custom toolkit). Null for servers that must be added again. */
  service_key: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  bots: { id: string; name: string; emoji: string; color: string }[];
  connection_id: string | null;
  created_at: string;
  can_manage: boolean;
}

export interface CreateToolServerDto {
  name: string;
  url: string;
  auth_kind: ToolServerAuthKind;
  token?: string;
  visibility?: Visibility;
  bot_ids?: string[];
  return_url?: string;
}

/** The address and sign-in type can't change after adding: remove the server and add it again instead. */
export interface UpdateToolServerDto {
  name?: string;
  visibility?: Visibility;
  bot_ids?: string[];
}

export interface ToolServerTestResult {
  ok: boolean;
  tool_count: number;
  tools: { name: string; description?: string }[];
  error?: string;
  tool_server: ToolServer;
}
