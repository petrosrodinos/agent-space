export interface AiModel {
  id: string;
  openrouter_id: string;
  name: string;
  provider: string;
  labels: string[];
  cost_tier: "LOW" | "MEDIUM" | "HIGH";
  context_length: number | null;
  supports_vision: boolean;
  is_recommended: boolean;
  is_org_default: boolean;
  allowed: boolean;
}

export interface BotTemplate {
  id: string;
  key: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  instructions: string;
  welcome_message: string | null;
  conversation_starters: string[];
  suggested_services: string[];
  model: { id: string; name: string } | null;
  approval_level: ApprovalLevel;
  cloud_computer: boolean;
  skills: { id: string; name: string; emoji: string | null; slug: string }[];
}

export const BotVisibilities = { PRIVATE: "PRIVATE", ORGANIZATION: "ORGANIZATION" } as const;
export type BotVisibility = (typeof BotVisibilities)[keyof typeof BotVisibilities];
export const MemoryKinds = { BOT_USER: "BOT_USER", BOT_SHARED: "BOT_SHARED", ORGANIZATION: "ORGANIZATION" } as const;
export type MemoryKind = (typeof MemoryKinds)[keyof typeof MemoryKinds];
export const ApprovalOverrides = { ALWAYS_ASK: "ALWAYS_ASK", DONT_ASK: "DONT_ASK" } as const;
export type ApprovalOverride = (typeof ApprovalOverrides)[keyof typeof ApprovalOverrides];
/** Per-action override in bot settings; DEFAULT = follow the bot's approval level. */
export const ApprovalOverrideChoices = { ...ApprovalOverrides, DEFAULT: "DEFAULT" } as const;
export type ApprovalOverrideChoice = (typeof ApprovalOverrideChoices)[keyof typeof ApprovalOverrideChoices];
export const ReplyLanguageChoices = { SAME: "SAME", EN: "EN", EL: "EL" } as const;
export type ReplyLanguageChoice = (typeof ReplyLanguageChoices)[keyof typeof ReplyLanguageChoices];

export const Creativities = { PRECISE: "PRECISE", BALANCED: "BALANCED", CREATIVE: "CREATIVE" } as const;
export type Creativity = (typeof Creativities)[keyof typeof Creativities];
export const BotClarifyingModes = { USER_PREFERENCE: "USER_PREFERENCE", ASK_MORE_OFTEN: "ASK_MORE_OFTEN", ASSUME_AND_PROCEED: "ASSUME_AND_PROCEED" } as const;
export type BotClarifyingMode = (typeof BotClarifyingModes)[keyof typeof BotClarifyingModes];
export const GroupResponseModes = { WHEN_RELEVANT_OR_MENTIONED: "WHEN_RELEVANT_OR_MENTIONED", ONLY_WHEN_MENTIONED: "ONLY_WHEN_MENTIONED" } as const;
export type GroupResponseMode = (typeof GroupResponseModes)[keyof typeof GroupResponseModes];
export const InteractiveRepliesModes = { BLOCKS_AND_MINI_APPS: "BLOCKS_AND_MINI_APPS", BLOCKS_ONLY: "BLOCKS_ONLY", OFF: "OFF" } as const;
export type InteractiveRepliesMode = (typeof InteractiveRepliesModes)[keyof typeof InteractiveRepliesModes];
export const SpokenReplyStyles = { SHORT_CONVERSATIONAL: "SHORT_CONVERSATIONAL", DETAILED: "DETAILED" } as const;
export type SpokenReplyStyle = (typeof SpokenReplyStyles)[keyof typeof SpokenReplyStyles];
export const MemoryScopes = { PER_USER: "PER_USER", SHARED: "SHARED" } as const;
export type MemoryScope = (typeof MemoryScopes)[keyof typeof MemoryScopes];
export const BotEditPolicies = { CREATOR_ONLY: "CREATOR_ONLY", CREATOR_AND_ADMINS: "CREATOR_AND_ADMINS" } as const;
export type BotEditPolicy = (typeof BotEditPolicies)[keyof typeof BotEditPolicies];
export const MaxTaskDurations = { MIN_15: "MIN_15", HOUR_1: "HOUR_1", HOUR_4: "HOUR_4", HOUR_24: "HOUR_24" } as const;
export type MaxTaskDuration = (typeof MaxTaskDurations)[keyof typeof MaxTaskDurations];
export const ApprovalLevels = { ALWAYS_ASK: "ALWAYS_ASK", IMPORTANT_ACTIONS: "IMPORTANT_ACTIONS", DONT_ASK: "DONT_ASK" } as const;
export type ApprovalLevel = (typeof ApprovalLevels)[keyof typeof ApprovalLevels];

export const ActionTypes = {
  SEND_MESSAGE: "SEND_MESSAGE",
  POST_PUBLICLY: "POST_PUBLICLY",
  EDIT_RECORDS: "EDIT_RECORDS",
  DELETE_DATA: "DELETE_DATA",
  PURCHASE_PAYMENT: "PURCHASE_PAYMENT",
  SHARE_FILES: "SHARE_FILES",
  ENTER_PASSWORD: "ENTER_PASSWORD",
  EXTERNAL_EMAIL: "EXTERNAL_EMAIL",
  CONSULT_SENSITIVE_BOT: "CONSULT_SENSITIVE_BOT",
  OTHER: "OTHER",
} as const;
export type ActionType = (typeof ActionTypes)[keyof typeof ActionTypes];

export interface BotBrief {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string | null;
  is_sensitive?: boolean;
  cloud_computer_enabled?: boolean;
}

export interface Bot extends BotBrief {
  organization_id: string;
  /** Created at sign-up; can't be deleted. */
  is_starter: boolean;
  created_by_id: string | null;
  template_id: string | null;
  instructions: string;
  welcome_message: string | null;
  conversation_starters: string[];
  model_id: string | null;
  model: { id: string; name: string; provider?: string; labels?: string[]; cost_tier?: string } | null;
  creativity: Creativity;
  style_override: boolean;
  reply_length: string | null;
  reply_tone: string | null;
  reply_formatting: string | null;
  emoji_usage: string | null;
  lock_style: boolean;
  reply_language: "EN" | "EL" | null;
  clarifying_questions: BotClarifyingMode;
  group_response: GroupResponseMode;
  web_search_enabled: boolean;
  image_generation_enabled: boolean;
  document_creation_enabled: boolean;
  interactive_replies_mode: InteractiveRepliesMode;
  artifacts_enabled: boolean;
  cloud_computer_enabled: boolean;
  use_skills_automatically: boolean;
  org_knowledge_enabled: boolean;
  voice_mode_enabled: boolean;
  voice: string | null;
  spoken_reply_style: SpokenReplyStyle;
  memory_enabled: boolean;
  memory_scope: MemoryScope;
  can_ask_other_bots: boolean;
  can_be_asked: boolean;
  is_sensitive: boolean;
  approval_level: ApprovalLevel;
  max_task_duration: MaxTaskDuration;
  monthly_usage_limit: number | null;
  visibility: BotVisibility;
  edit_policy: BotEditPolicy;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  created_by?: { id: string; name: string | null; email?: string } | null;
  approval_rules?: { action_type: ActionType; override: ApprovalOverride }[];
  bot_connections?: { connection_id: string; is_default_for_service: boolean; connection: { id: string; label: string; service_key: string; service_name: string; status: string; visibility: string; account_identifier: string | null } }[];
  bot_skills?: { skill: { id: string; name: string; emoji: string | null; slug: string; description: string } }[];
  _count?: { memories?: number; knowledge_items?: number; bot_skills?: number; bot_connections?: number };
}

export type CreateBotDto = Partial<Omit<Bot, "id" | "model" | "can_edit" | "created_at" | "updated_at" | "approval_rules" | "bot_connections" | "bot_skills" | "_count" | "created_by">> & { name: string; template_id?: string };
export type UpdateBotDto = Partial<CreateBotDto>;

export interface BotDraft {
  name: string;
  emoji: string;
  color: string;
  description: string;
  instructions: string;
  conversation_starters: string[];
  suggested_services: string[];
  template_id: string | null;
  model_id: string | null;
}

export interface Memory {
  id: string;
  kind: MemoryKind;
  bot_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

/** A memory about the current user, with the bot that remembers it (Settings → Memory). */
export interface MyMemory extends Memory {
  bot: { id: string; name: string } | null;
}

/** Tabs of the bot side panel in a direct chat. */
export const BotPanelTabs = { ACTIVITY: "activity", LIBRARY: "library" } as const;
export type BotPanelTab = (typeof BotPanelTabs)[keyof typeof BotPanelTabs];
