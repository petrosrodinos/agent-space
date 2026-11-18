import { PickerValues } from "@/config/constants/filters";
import type { OrgRole } from "@/features/users/interfaces/users.interfaces";

export const OrgRoleFormOptions: { id: OrgRole; label: string; description: string }[] = [
  { id: "OWNER", label: "Owner", description: "Everything, including billing and deleting the organisation" },
  { id: "ADMIN", label: "Admin", description: "Manage members, shared connections, settings and organisation bots" },
  { id: "MEMBER", label: "Member", description: "Use and create their own bots, chats, skills and connections" },
];

export const InvitationExpiryOptions = [
  { id: "DAY_1", label: "1 day" },
  { id: "DAY_3", label: "3 days" },
  { id: "DAY_7", label: "7 days" },
  { id: "DAY_30", label: "30 days" },
] as const;

export const WhoCanOptions = [
  { id: "EVERYONE", label: "Everyone" },
  { id: "OWNERS_ADMINS", label: "Owners and Admins only" },
] as const;

export const ModelPolicyOptions = [
  { id: "ALL_MODELS", label: "All models" },
  { id: "APPROVED_LIST", label: "Approved list only" },
] as const;

export const MinApprovalLevelOptions = [
  { id: "NONE", label: "None" },
  { id: "IMPORTANT_ACTIONS", label: "Ask for important actions" },
  { id: "ALWAYS_ASK", label: "Always ask" },
] as const;

export const OrgConversationRetentionOptions = [
  { id: "FOREVER", label: "Forever" },
  { id: "YEAR_1", label: "1 year" },
  { id: "DAYS_90", label: "90 days" },
  { id: "DAYS_30", label: "30 days" },
] as const;

export const MaxFileSizeOptions = [
  { id: "MB_25", label: "25 MB" },
  { id: "MB_50", label: "50 MB" },
  { id: "MB_100", label: "100 MB" },
] as const;

export const LimitReachedActionOptions = [
  { id: "PAUSE_AND_NOTIFY", label: "Pause and notify" },
  { id: "SWITCH_TO_CHEAPER_MODEL", label: "Switch to a cheaper model" },
  { id: "NOTIFY_ONLY", label: "Notify only" },
] as const;

export const EnforcedApprovalOptions = [
  { id: "EXTERNAL_EMAIL", label: "Emails to people outside the company" },
  { id: "PURCHASE_PAYMENT", label: "Payments and purchases" },
  { id: "POST_PUBLICLY", label: "Public posts" },
  { id: "DELETE_DATA", label: "Deleting data" },
  { id: "SHARE_FILES", label: "Sharing files externally" },
] as const;

export const UsageLimitScopeOptions = [
  { id: "ORGANIZATION", label: "Whole organisation" },
  { id: "MEMBER", label: "Per member" },
  { id: "BOT", label: "Per bot" },
] as const;

/** Organisation approval timeout (minutes as strings; KEEP_WAITING = no timeout). */
export const ApprovalTimeoutMinuteOptions = [
  { id: PickerValues.KEEP_WAITING, label: "Keep waiting" },
  { id: "60", label: "Cancel after 1 hour" },
  { id: "1440", label: "Cancel after 24 hours" },
  { id: "10080", label: "Cancel after 7 days" },
] as const;
