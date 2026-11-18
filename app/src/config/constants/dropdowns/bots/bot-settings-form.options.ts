import type { ActionType, ApprovalLevel } from "@/features/bots/interfaces/bots.interfaces";

export const ApprovalLevelFormOptions: { id: ApprovalLevel; label: string; description: string }[] = [
  { id: "ALWAYS_ASK", label: "Always ask", description: "Ask before every action that changes something." },
  { id: "IMPORTANT_ACTIONS", label: "Ask for important actions", description: "Ask before sending, posting, deleting, paying or sharing." },
  { id: "DONT_ASK", label: "Don't ask", description: "Act without asking (organisation rules still apply)." },
];

export const ActionTypeOptions: { id: ActionType; label: string }[] = [
  { id: "SEND_MESSAGE", label: "Sending messages / emails" },
  { id: "EXTERNAL_EMAIL", label: "Emails to people outside the company" },
  { id: "POST_PUBLICLY", label: "Posting publicly" },
  { id: "EDIT_RECORDS", label: "Editing records" },
  { id: "DELETE_DATA", label: "Deleting things" },
  { id: "PURCHASE_PAYMENT", label: "Purchases and payments" },
  { id: "SHARE_FILES", label: "Sharing files" },
  { id: "ENTER_PASSWORD", label: "Entering passwords on websites" },
  { id: "CONSULT_SENSITIVE_BOT", label: "Asking a Sensitive bot" },
  { id: "OTHER", label: "Confirm changes" },
];

export const ApprovalOverrideOptions = [
  { id: "DEFAULT", label: "Use overall level" },
  { id: "ALWAYS_ASK", label: "Always ask" },
  { id: "DONT_ASK", label: "Don't ask" },
] as const;

export const CreativityOptions = [
  { id: "PRECISE", label: "Precise" },
  { id: "BALANCED", label: "Balanced" },
  { id: "CREATIVE", label: "Creative" },
] as const;

export const ReplyLengthOptions = [
  { id: "SHORT", label: "Short" },
  { id: "BALANCED", label: "Balanced" },
  { id: "DETAILED", label: "Detailed" },
] as const;

export const ReplyToneOptions = [
  { id: "CASUAL", label: "Casual" },
  { id: "FRIENDLY_PROFESSIONAL", label: "Friendly-professional" },
  { id: "FORMAL", label: "Formal" },
] as const;

export const ReplyFormattingOptions = [
  { id: "MIXED", label: "Mixed" },
  { id: "MOSTLY_BULLETS", label: "Mostly bullet points" },
  { id: "MOSTLY_PARAGRAPHS", label: "Mostly paragraphs" },
] as const;

export const EmojiUsageOptions = [
  { id: "NONE", label: "None" },
  { id: "OCCASIONALLY", label: "Occasionally" },
  { id: "OFTEN", label: "Often" },
] as const;

export const BotClarifyingOptions = [
  { id: "USER_PREFERENCE", label: "Use each user's preference" },
  { id: "ASK_MORE_OFTEN", label: "Ask more often" },
  { id: "ASSUME_AND_PROCEED", label: "Assume and proceed" },
] as const;

export const BotReplyLanguageOptions = [
  { id: "SAME", label: "Same as the user's message" },
  { id: "EN", label: "Always English" },
  { id: "EL", label: "Always Greek" },
] as const;

export const GroupResponseOptions = [
  { id: "WHEN_RELEVANT_OR_MENTIONED", label: "When relevant or @mentioned" },
  { id: "ONLY_WHEN_MENTIONED", label: "Only when @mentioned" },
] as const;

export const InteractiveRepliesOptions = [
  { id: "BLOCKS_AND_MINI_APPS", label: "Building blocks and custom mini-apps" },
  { id: "BLOCKS_ONLY", label: "Building blocks only" },
  { id: "OFF", label: "Off" },
] as const;

export const MemoryScopeOptions = [
  { id: "PER_USER", label: "Per user" },
  { id: "SHARED", label: "Shared across everyone using this bot" },
] as const;

export const MaxTaskDurationOptions = [
  { id: "MIN_15", label: "15 minutes" },
  { id: "HOUR_1", label: "1 hour" },
  { id: "HOUR_4", label: "4 hours" },
  { id: "HOUR_24", label: "24 hours" },
] as const;

export const BotVisibilityOptions = [
  { id: "PRIVATE", label: "Private" },
  { id: "ORGANIZATION", label: "Organisation-wide" },
] as const;

export const BotEditPolicyOptions = [
  { id: "CREATOR_ONLY", label: "Creator only" },
  { id: "CREATOR_AND_ADMINS", label: "Creator + Owners/Admins" },
] as const;

export const SpokenReplyStyleOptions = [
  { id: "SHORT_CONVERSATIONAL", label: "Short and conversational" },
  { id: "DETAILED", label: "Detailed" },
] as const;

export const ModelCostTierOptions = [
  { id: "LOW", label: "$" },
  { id: "MEDIUM", label: "$$" },
  { id: "HIGH", label: "$$$" },
] as const;

export const ModelLabelOptions = [
  { id: "fast", label: "Fast" },
  { id: "smart", label: "Smart" },
  { id: "writing", label: "Best for writing" },
  { id: "coding", label: "Best for coding" },
  { id: "vision", label: "Can see images" },
] as const;
