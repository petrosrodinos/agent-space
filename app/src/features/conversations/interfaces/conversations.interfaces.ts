import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";

/** Sub-views of a conversation URL (`/c/:id/:view`). */
export const ConversationViews = { DETAILS: "details" } as const;
export type ConversationView = (typeof ConversationViews)[keyof typeof ConversationViews];
export const ConversationTypes = { DIRECT: "DIRECT", SHARED_BOT: "SHARED_BOT", GROUP: "GROUP" } as const;
export type ConversationType = (typeof ConversationTypes)[keyof typeof ConversationTypes];

export const MessageAuthorTypes = { USER: "USER", BOT: "BOT", SYSTEM: "SYSTEM" } as const;
export type MessageAuthorType = (typeof MessageAuthorTypes)[keyof typeof MessageAuthorTypes];

export const MessageSources = { TEXT: "TEXT", VOICE: "VOICE", AUTOMATION: "AUTOMATION", BOT: "BOT", EMAIL: "EMAIL", SLACK: "SLACK", WHATSAPP: "WHATSAPP" } as const;
export type MessageSource = (typeof MessageSources)[keyof typeof MessageSources];

export const MessageStatuses = { PENDING: "PENDING", STREAMING: "STREAMING", COMPLETED: "COMPLETED", FAILED: "FAILED", STOPPED: "STOPPED" } as const;
export type MessageStatus = (typeof MessageStatuses)[keyof typeof MessageStatuses];

/** Kinds of content parts in a message (§7.3, §7.4, §8.8). */
export const MessagePartTypes = {
  TEXT: "text",
  TOOL: "tool",
  UI: "ui",
  APPROVAL: "approval",
  SECRET_INPUT: "secret-input",
  SKILL: "skill",
  CONSULTED: "consulted",
  FILE: "file",
  SOURCES: "sources",
  FOLLOW_UPS: "follow-ups",
  NOTICE: "notice",
  AUTOMATION: "automation",
  COMPUTER_HANDOFF: "computer_handoff",
  ERROR: "error",
  INTERACTION: "interaction",
  ARTIFACT: "artifact",
  CLIENT_REF: "client-ref",
  /** §7.6: the spoken message came with a camera or screen picture. */
  VISUAL: "visual",
} as const;
export type MessagePartType = (typeof MessagePartTypes)[keyof typeof MessagePartTypes];

export const ToolPartStatuses = { RUNNING: "running", DONE: "done", ERROR: "error", WAITING: "waiting", STOPPED: "stopped" } as const;
export type ToolPartStatus = (typeof ToolPartStatuses)[keyof typeof ToolPartStatuses];

export const SecretInputStatuses = { PENDING: "pending", SAVED: "saved", CANCELLED: "cancelled" } as const;
export type SecretInputStatus = (typeof SecretInputStatuses)[keyof typeof SecretInputStatuses];

export const SecretKinds = { API_KEY: "api_key", MCP_TOKEN: "mcp_token", WEBSITE_LOGIN: "website_login", PASSWORD_MANAGER: "password_manager" } as const;
export type SecretKind = (typeof SecretKinds)[keyof typeof SecretKinds];

export const ComputerHandoffKinds = { SIGN_IN: "sign_in", TWO_STEP_CODE: "two_step_code", CAPTCHA: "captcha", OTHER: "other" } as const;
export type ComputerHandoffKind = (typeof ComputerHandoffKinds)[keyof typeof ComputerHandoffKinds];

export const ComputerHandoffStatuses = { WAITING: "waiting", DONE: "done", CANCELLED: "cancelled" } as const;
export type ComputerHandoffStatus = (typeof ComputerHandoffStatuses)[keyof typeof ComputerHandoffStatuses];

export const ArtifactPartStatuses = { PUBLISHED: "published", DRAFT: "draft" } as const;
export const ArtifactPartActions = { CREATED: "created", UPDATED: "updated" } as const;

export const ApprovalPreviewKinds = { CHANGE: "change", TOOL: "tool", SKILL: "skill", CONSULT: "consult", COMPUTER: "computer" } as const;
export type ApprovalPreviewKind = (typeof ApprovalPreviewKinds)[keyof typeof ApprovalPreviewKinds];

type T = typeof MessagePartTypes;

export interface PersonBrief {
  id: string;
  name: string | null;
  email: string;
  avatar_file_id?: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  emoji: string;
  color: string;
  lead_bot: BotBrief | null;
  is_temporary: boolean;
  created_by_id: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
  bots: (BotBrief & { participant_id: string })[];
  users: (PersonBrief & { participant_id: string })[];
  me: { is_favourite: boolean; is_archived: boolean; is_muted: boolean; unread_count: number; folder_id: string | null; last_read_at: string | null } | null;
  last_message?: { id: string; preview: string; author_type: string; author_name: string | null; created_at: string } | null;
  pending_approvals?: number;
  working_bot_ids?: string[];
}

export type MessagePart =
  | { type: T["TEXT"]; text: string }
  | { type: T["TOOL"]; call_id: string; step_id: string; name: string; title: string; status: ToolPartStatus; error?: string; duration_ms?: number; undo?: { label: string; until: string }; undone?: boolean }
  | { type: T["UI"]; id: string; title: string; blocks: UiBlock[]; fallback_text: string }
  | { type: T["APPROVAL"]; approval_id: string; title: string; action_type: string; preview: ApprovalPreview; status: string; requires_tap?: boolean; tool?: string }
  | { type: T["SECRET_INPUT"]; request_id: string; run_id: string; for_user_id: string; for_user_name: string; purpose: string; suggested_label: string; service: string | null; kind: SecretKind; website?: string | null; replace_credential_id: string | null; bot_id: string; status: SecretInputStatus; saved?: { label: string; masked_hint: string; credential_id: string } | null; redacted?: boolean }
  | { type: T["SKILL"]; skill_id: string; name: string; emoji: string | null; slug: string }
  | { type: T["CONSULTED"]; bot: BotBrief; question: string }
  | { type: T["FILE"]; file_id: string; filename: string; mimetype: string; size: number }
  | { type: T["SOURCES"]; sources: { url: string; title: string | null }[] }
  | { type: T["FOLLOW_UPS"]; items: string[] }
  | { type: T["NOTICE"]; text: string }
  | { type: T["AUTOMATION"]; automation_id: string; name: string; schedule: string | null; next_run_at: string | null }
  | { type: T["COMPUTER_HANDOFF"]; request_id: string; bot_id: string; reason: string; kind: ComputerHandoffKind; status: ComputerHandoffStatus }
  | { type: T["ERROR"]; message: string }
  | { type: T["INTERACTION"]; message_id: string; component_id: string; payload: Record<string, unknown>; total_responses: number }
  | { type: T["ARTIFACT"]; artifact_id: string; title: string; artifact_type: string; version: number; status: (typeof ArtifactPartStatuses)[keyof typeof ArtifactPartStatuses]; action: (typeof ArtifactPartActions)[keyof typeof ArtifactPartActions]; description?: string | null }
  | { type: T["CLIENT_REF"]; client_id: string };

export interface ApprovalPreview {
  kind?: ApprovalPreviewKind;
  target?: string;
  changes?: { field: string; to: string }[];
  warning?: string;
  service?: string;
  account?: string;
  account_identifier?: string | null;
  tool?: string;
  input?: Record<string, unknown>;
  name?: string;
  emoji?: string;
  description?: string;
  instructions?: string;
  questions?: string[];
  from?: string;
  to?: string;
  question?: string;
  [key: string]: unknown;
}

export type UiBlock = { type: string; [key: string]: any };

/** Interactive reply building blocks (§7.4) — must match the API's show_ui schema. */
export const UiBlockTypes = {
  HEADING: "heading",
  TEXT: "text",
  CARD: "card",
  STATS: "stats",
  TABLE: "table",
  CHART: "chart",
  LIST: "list",
  CHECKLIST: "checklist",
  PROGRESS: "progress",
  BUTTONS: "buttons",
  FORM: "form",
  TABS: "tabs",
  IMAGE: "image",
  KV: "kv",
  CALLOUT: "callout",
  DIVIDER: "divider",
} as const;
export const ChartKinds = { BAR: "bar", LINE: "line", AREA: "area", PIE: "pie" } as const;
export const FormFieldTypes = { TEXT: "text", TEXTAREA: "textarea", NUMBER: "number", EMAIL: "email", DATE: "date", SELECT: "select", CHECKBOX: "checkbox" } as const;
export const StatTrends = { UP: "up", DOWN: "down" } as const;

/** Message text sent when the user sends only attachments. */
export const ATTACHMENT_ONLY_CONTENT = "Sent attachments";

export interface MessageFileRef {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  status: string;
}

/** Quote of the message a reply points at. `content` is trimmed server-side; null when the original was deleted. */
export interface ReplyPreview {
  id: string;
  author_type: MessageAuthorType;
  author_name: string | null;
  author_user_id: string | null;
  content: string | null;
  has_files: boolean;
  deleted: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  author_type: MessageAuthorType;
  author_user: PersonBrief | null;
  author_bot: BotBrief | null;
  source: MessageSource;
  status: MessageStatus;
  content: string | null;
  parts: MessagePart[];
  run: { id: string; status: string; fallback_used: boolean; user_id?: string | null } | null;
  run_id: string | null;
  parent_message_id: string | null;
  reply_to_message_id: string | null;
  reply_to: ReplyPreview | null;
  branch_from_message_id: string | null;
  branch_index: number;
  model_id: string | null;
  is_pinned: boolean;
  edited_at: string | null;
  secret_masked: boolean;
  created_at: string;
  updated_at: string;
  reply_count: number;
  reactions: { emoji: string; count: number; user_ids: string[] }[];
  files: MessageFileRef[];
  /** Client-only: optimistic message waiting for the server. */
  pending?: boolean;
}

export interface SendMessageDto {
  content: string;
  file_ids?: string[];
  parent_message_id?: string;
  reply_to_message_id?: string;
  send_anyway?: boolean;
  client_id?: string;
}

export interface SearchHit {
  id: string;
  conversation: { id: string; name: string | null; type: ConversationType };
  author: { name: string | null; emoji?: string; color?: string } | null;
  author_type: string;
  snippet: string;
  created_at: string;
}
