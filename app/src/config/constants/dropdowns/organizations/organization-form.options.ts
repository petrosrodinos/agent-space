import { PickerValues } from "@/config/constants/filters";
import { ApprovalTimeoutActions, type ApprovalTimeoutAction } from "@/features/organizations/interfaces/organizations.interfaces";
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

/** Extra approvals that need fingerprint / face unlock on the phone (payments and website passwords always do). */
export const BiometricApprovalScopeOptions = [
  { id: "ALL_APPROVALS", label: "All approvals" },
  { id: "EXTERNAL_EMAILS", label: "Emails to people outside the company" },
  { id: "DELETING_DATA", label: "Deleting data" },
] as const;

export const UsageLimitScopeOptions = [
  { id: "ORGANIZATION", label: "Whole organisation" },
  { id: "MEMBER", label: "Per member" },
  { id: "BOT", label: "Per bot" },
] as const;

/** Prefix marking an "accept automatically" timeout option, e.g. `approve:60`. */
const AUTO_APPROVE_PREFIX = "approve:";

/**
 * Organisation approval timeout: what happens and after how long, as one picker value.
 * KEEP_WAITING = no timeout; "60" = cancel after 60 minutes; "approve:60" = accept automatically after 60 minutes.
 */
export const ApprovalTimeoutMinuteOptions = [
  { id: PickerValues.KEEP_WAITING, label: "Keep waiting" },
  { id: "60", label: "Cancel after 1 hour" },
  { id: "1440", label: "Cancel after 24 hours" },
  { id: "10080", label: "Cancel after 7 days" },
  { id: `${AUTO_APPROVE_PREFIX}60`, label: "Accept automatically after 1 hour" },
  { id: `${AUTO_APPROVE_PREFIX}1440`, label: "Accept automatically after 24 hours" },
  { id: `${AUTO_APPROVE_PREFIX}10080`, label: "Accept automatically after 7 days" },
] as const;

/** Settings → picker value. */
export const toApprovalTimeoutValue = (minutes: number | null, action: ApprovalTimeoutAction): string =>
  minutes == null ? PickerValues.KEEP_WAITING : action === ApprovalTimeoutActions.APPROVE ? `${AUTO_APPROVE_PREFIX}${minutes}` : String(minutes);

/** Picker value → settings. */
export const fromApprovalTimeoutValue = (v: string): { approval_timeout_minutes: number | null; approval_timeout_action: ApprovalTimeoutAction } => {
  if (v === PickerValues.KEEP_WAITING) return { approval_timeout_minutes: null, approval_timeout_action: ApprovalTimeoutActions.CANCEL };
  const auto = v.startsWith(AUTO_APPROVE_PREFIX);
  return {
    approval_timeout_minutes: Number(auto ? v.slice(AUTO_APPROVE_PREFIX.length) : v),
    approval_timeout_action: auto ? ApprovalTimeoutActions.APPROVE : ApprovalTimeoutActions.CANCEL,
  };
};

/** Usage → Charges tab: quick date ranges. CUSTOM shows the from/to date fields. */
export const UsageRanges = { THIS_MONTH: "this_month", LAST_7: "last_7", LAST_30: "last_30", LAST_MONTH: "last_month", ALL: "all", CUSTOM: "custom" } as const;
export type UsageRange = (typeof UsageRanges)[keyof typeof UsageRanges];
export const UsageRangeOptions = [
  { id: UsageRanges.THIS_MONTH, label: "This month" },
  { id: UsageRanges.LAST_7, label: "Last 7 days" },
  { id: UsageRanges.LAST_30, label: "Last 30 days" },
  { id: UsageRanges.LAST_MONTH, label: "Last month" },
  { id: UsageRanges.ALL, label: "All time" },
  { id: UsageRanges.CUSTOM, label: "Custom range" },
] as const;
