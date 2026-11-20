export const ThemeOptions = [
  { id: "SYSTEM", label: "System" },
  { id: "LIGHT", label: "Light" },
  { id: "DARK", label: "Dark" },
] as const;

export const TextSizeOptions = [
  { id: "SMALL", label: "Small" },
  { id: "MEDIUM", label: "Medium" },
  { id: "LARGE", label: "Large" },
] as const;

export const LayoutDensityOptions = [
  { id: "COMFORTABLE", label: "Comfortable" },
  { id: "COMPACT", label: "Compact" },
] as const;

export const AppLanguageOptions = [
  { id: "EN", label: "English" },
  { id: "EL", label: "Ελληνικά (Greek)" },
] as const;

export const ReplyLanguageOptions = [
  { id: "SAME_AS_MESSAGE", label: "Same as my message" },
  { id: "ALWAYS_EN", label: "Always English" },
  { id: "ALWAYS_EL", label: "Always Greek" },
] as const;

export const TimeFormatOptions = [
  { id: "REGION", label: "Based on region" },
  { id: "H24", label: "24-hour" },
  { id: "H12", label: "12-hour" },
] as const;

export const ClarifyingQuestionsOptions = [
  { id: "ASK_MORE_OFTEN", label: "Ask more often" },
  { id: "BALANCED", label: "Balanced" },
  { id: "ASSUME_AND_PROCEED", label: "Assume and proceed" },
] as const;

export const ActivityStepsOptions = [
  { id: "COLLAPSED", label: "Collapsed summary" },
  { id: "EXPANDED", label: "Expanded" },
  { id: "HIDDEN", label: "Hidden" },
] as const;

export const SendWithOptions = [
  { id: "ENTER", label: "Enter (Shift+Enter for new line)" },
  { id: "CTRL_ENTER", label: "Ctrl/Cmd + Enter" },
] as const;

export const GroupReplyModeOptions = [
  { id: "MOST_RELEVANT", label: "The most relevant bot when not @mentioned" },
  { id: "ONLY_WHEN_MENTIONED", label: "Only when @mentioned" },
] as const;

export const ApprovalTimeoutOptions = [
  { id: "KEEP_WAITING", label: "Keep waiting" },
  { id: "CANCEL_AFTER_1H", label: "Cancel after 1 hour" },
  { id: "CANCEL_AFTER_24H", label: "Cancel after 24 hours" },
] as const;

export const ApprovalChannelOptions = [
  { id: "IN_APP_PUSH", label: "In app + push" },
  { id: "IN_APP_PUSH_EMAIL", label: "In app + push, also email" },
] as const;

export const TaskCheckInOptions = [
  { id: "MIN_15", label: "15 minutes" },
  { id: "HOUR_1", label: "1 hour" },
  { id: "HOUR_4", label: "4 hours" },
  { id: "NEVER", label: "Never" },
] as const;

export const ConversationRetentionOptions = [
  { id: "NEVER", label: "Never" },
  { id: "DAYS_30", label: "30 days" },
  { id: "DAYS_90", label: "90 days" },
  { id: "YEAR_1", label: "1 year" },
] as const;

export const DevicePlatformOptions = [
  { id: "WEB", label: "Web" },
  { id: "DESKTOP", label: "Desktop" },
  { id: "ANDROID", label: "Android" },
] as const;

/** §7.6 Voice mode. */
export const SpeakingSpeedOptions = [
  { id: "SLOWER", label: "Slower" },
  { id: "NORMAL", label: "Normal" },
  { id: "FASTER", label: "Faster" },
] as const;

export const VoiceInputModeOptions = [
  { id: "HANDS_FREE", label: "Hands-free" },
  { id: "PUSH_TO_TALK", label: "Push to talk" },
] as const;
