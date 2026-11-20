export const Themes = { SYSTEM: "SYSTEM", LIGHT: "LIGHT", DARK: "DARK" } as const;
export type Theme = (typeof Themes)[keyof typeof Themes];
/** Colour preset per user per organisation (stored on the membership). */
export const ColorThemes = {
  NEUTRAL: "NEUTRAL",
  GRAPE: "GRAPE",
  OCEAN: "OCEAN",
  SKY: "SKY",
  TEAL: "TEAL",
  FOREST: "FOREST",
  LIME: "LIME",
  SUNSET: "SUNSET",
  AMBER: "AMBER",
  ROSE: "ROSE",
  CRIMSON: "CRIMSON",
  LAVENDER: "LAVENDER",
  SLATE: "SLATE",
} as const;
export type ColorTheme = (typeof ColorThemes)[keyof typeof ColorThemes];
export const SpeakingSpeeds ={ SLOWER: "SLOWER", NORMAL: "NORMAL", FASTER: "FASTER" } as const;
export type SpeakingSpeed = (typeof SpeakingSpeeds)[keyof typeof SpeakingSpeeds];
export const VoiceInputModes = { HANDS_FREE: "HANDS_FREE", PUSH_TO_TALK: "PUSH_TO_TALK" } as const;
export type VoiceInputMode = (typeof VoiceInputModes)[keyof typeof VoiceInputModes];
export const SendWithKeys = { ENTER: "ENTER", CTRL_ENTER: "CTRL_ENTER" } as const;
export type SendWithKey = (typeof SendWithKeys)[keyof typeof SendWithKeys];
export const ActivityStepsDisplays = { COLLAPSED: "COLLAPSED", EXPANDED: "EXPANDED", HIDDEN: "HIDDEN" } as const;
export type ActivityStepsDisplay = (typeof ActivityStepsDisplays)[keyof typeof ActivityStepsDisplays];
export const Platforms = { WEB: "WEB", DESKTOP: "DESKTOP", ANDROID: "ANDROID" } as const;
export type Platform = (typeof Platforms)[keyof typeof Platforms];

export const ReplyLengths = { SHORT: "SHORT", BALANCED: "BALANCED", DETAILED: "DETAILED" } as const;
export type ReplyLength = (typeof ReplyLengths)[keyof typeof ReplyLengths];
export const ReplyTones = { CASUAL: "CASUAL", FRIENDLY_PROFESSIONAL: "FRIENDLY_PROFESSIONAL", FORMAL: "FORMAL" } as const;
export type ReplyTone = (typeof ReplyTones)[keyof typeof ReplyTones];
export const ReplyFormattings = { MIXED: "MIXED", MOSTLY_BULLETS: "MOSTLY_BULLETS", MOSTLY_PARAGRAPHS: "MOSTLY_PARAGRAPHS" } as const;
export type ReplyFormatting = (typeof ReplyFormattings)[keyof typeof ReplyFormattings];
export const EmojiUsages = { NONE: "NONE", OCCASIONALLY: "OCCASIONALLY", OFTEN: "OFTEN" } as const;
export type EmojiUsage = (typeof EmojiUsages)[keyof typeof EmojiUsages];
export const TextSizes = { SMALL: "SMALL", MEDIUM: "MEDIUM", LARGE: "LARGE" } as const;
export type TextSize = (typeof TextSizes)[keyof typeof TextSizes];
export const LayoutDensities = { COMFORTABLE: "COMFORTABLE", COMPACT: "COMPACT" } as const;
export type LayoutDensity = (typeof LayoutDensities)[keyof typeof LayoutDensities];

export const OrgRoles = { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" } as const;
export type OrgRole = (typeof OrgRoles)[keyof typeof OrgRoles];

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_file_id: string | null;
  job_title: string | null;
  about_me: string | null;
  timezone: string;
  working_hours: { days?: number[]; start?: string; end?: string } | null;
  role: string;
  created_at: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
  logo_file_id: string | null;
  is_personal: boolean;
  role: OrgRole;
  color_theme: ColorTheme;
  member_count: number;
}

export interface UserSettings {
  voice_override: string | null;
  speaking_speed: SpeakingSpeed;
  voice_input_mode: VoiceInputMode;
  theme: Theme;
  text_size: TextSize;
  layout_density: LayoutDensity;
  app_language: "EN" | "EL";
  reply_language: "SAME_AS_MESSAGE" | "ALWAYS_EN" | "ALWAYS_EL";
  time_format: "REGION" | "H24" | "H12";
  reply_length: ReplyLength;
  reply_tone: ReplyTone;
  reply_formatting: ReplyFormatting;
  emoji_usage: EmojiUsage;
  show_sources: boolean;
  suggested_follow_ups: boolean;
  clarifying_questions: "ASK_MORE_OFTEN" | "BALANCED" | "ASSUME_AND_PROCEED";
  proactive_suggestions: boolean;
  suggest_skills: boolean;
  activity_steps_display: ActivityStepsDisplay;
  interactive_replies: boolean;
  artifact_default_sharing: string;
  default_bot_id: string | null;
  send_with: SendWithKey;
  group_reply_mode: "MOST_RELEVANT" | "ONLY_WHEN_MENTIONED";
  show_typing_indicators: boolean;
  memory_enabled: boolean;
  use_past_conversations: boolean;
  default_approval_level: "ALWAYS_ASK" | "IMPORTANT_ACTIONS" | "DONT_ASK";
  approval_timeout: "KEEP_WAITING" | "CANCEL_AFTER_1H" | "CANCEL_AFTER_24H";
  approval_channel: "IN_APP_PUSH" | "IN_APP_PUSH_EMAIL";
  notify_task_finished: boolean;
  task_check_in: "MIN_15" | "HOUR_1" | "HOUR_4" | "NEVER";
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  daily_email_digest: boolean;
  sounds_enabled: boolean;
  connection_problem_alerts: boolean;
  secret_problem_alerts: boolean;
  auto_delete_conversations: "NEVER" | "DAYS_30" | "DAYS_90" | "YEAR_1";
  purge_deleted_artifacts: boolean;
  [key: string]: unknown;
}

export interface MeResponse {
  user: User;
  settings: UserSettings;
  organizations: OrganizationSummary[];
}

export interface Device {
  id: string;
  name: string;
  platform: Platform;
  app_version: string | null;
  last_seen_at: string;
  is_online?: boolean;
  created_at: string;
}

/** §14.3 Permissions: one switch per device and tool. */
export const DeviceToolPermissions = { ASK_EACH_TIME: "ASK_EACH_TIME", ALWAYS_ALLOW: "ALWAYS_ALLOW", NEVER: "NEVER" } as const;
export type DeviceToolPermission = (typeof DeviceToolPermissions)[keyof typeof DeviceToolPermissions];

export interface DeviceToolSettings {
  device_id: string;
  platform: Platform;
  is_online: boolean;
  capabilities: string[];
  allowed_folders: string[];
  blocked_apps: string[];
  permissions: Record<string, DeviceToolPermission>;
}

export interface SessionInfo {
  id: string;
  device: { name: string; platform: string } | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
  current: boolean;
}

export type UpdateProfileDto = Partial<Pick<User, "name" | "job_title" | "about_me" | "timezone" | "working_hours" | "avatar_file_id">>;
