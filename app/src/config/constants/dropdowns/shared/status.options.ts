import { ALL_FILTER, TaskFilters } from "@/config/constants/filters";
export const RunStatusOptions = [
  { id: "QUEUED", label: "Queued" },
  { id: "RUNNING", label: "Working" },
  { id: "WAITING_APPROVAL", label: "Waiting for approval" },
  { id: "WAITING_INPUT", label: "Waiting for you" },
  { id: "WAITING_DEVICE", label: "Waiting for a device" },
  { id: "WAITING_COMPUTER", label: "Waiting for the computer" },
  { id: "COMPLETED", label: "Done" },
  { id: "FAILED", label: "Failed" },
  { id: "STOPPED", label: "Stopped" },
] as const;

export const TaskFilterOptions = [
  { id: TaskFilters.ALL, label: "All" },
  { id: TaskFilters.ACTIVE, label: "Running" },
  { id: TaskFilters.WAITING, label: "Waiting" },
  { id: TaskFilters.DONE, label: "Finished" },
  { id: TaskFilters.FAILED, label: "Failed" },
] as const;

export const ConnectionStatusOptions = [
  { id: "ACTIVE", label: "Active" },
  { id: "NEEDS_RECONNECTING", label: "Reconnect" },
  { id: "ERROR", label: "Error" },
] as const;

export const CredentialStatusOptions = [
  { id: "ACTIVE", label: "Active" },
  { id: "NOT_WORKING", label: "Not working" },
  { id: "EXPIRED", label: "Expired" },
  { id: "NEEDS_RECONNECTING", label: "Needs re-connecting" },
] as const;

export const CredentialStatusFilterOptions = [{ id: ALL_FILTER, label: "All statuses" }, ...CredentialStatusOptions] as const;

export const CredentialKindOptions = [
  { id: "API_KEY", label: "Access key" },
  { id: "MCP_TOKEN", label: "Tool server token" },
  { id: "MCP_OAUTH", label: "Tool server sign-in" },
] as const;

export const VisibilityOptions = [
  { id: "PRIVATE", label: "Private" },
  { id: "SHARED", label: "Shared with the organisation" },
] as const;

export const CredentialEventOptions = [
  { id: "CREATED", label: "Added" },
  { id: "REPLACED", label: "Value replaced" },
  { id: "RENAMED", label: "Renamed" },
  { id: "SHARED", label: "Shared" },
  { id: "MADE_PRIVATE", label: "Made private" },
  { id: "BOTS_CHANGED", label: "Bots changed" },
  { id: "TESTED", label: "Tested" },
  { id: "USED", label: "Used" },
  { id: "DELETED", label: "Deleted" },
] as const;

export const ApprovalStatusOptions = [
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "EDITED_APPROVED", label: "Edited and approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "EXPIRED", label: "Expired" },
] as const;

export const SkillSharingOptions = [
  { id: "PRIVATE", label: "Private" },
  { id: "SPECIFIC_MEMBERS", label: "Specific members" },
  { id: "ORGANIZATION", label: "Organisation" },
] as const;

export const SkillRoleOptions = [
  { id: "OWNER", label: "Owner" },
  { id: "EDITOR", label: "Editor" },
  { id: "USER", label: "User" },
] as const;

export const SkillTabOptions = [
  { id: ALL_FILTER, label: "All" },
  { id: "mine", label: "Mine" },
  { id: "shared", label: "Shared with me" },
  { id: "organization", label: "Organisation" },
  { id: "starter", label: "Starter library" },
  { id: "deleted", label: "Recently deleted" },
] as const;

export const NotificationEventOptions = [
  { id: "NEW_MESSAGE", label: "New messages" },
  { id: "MENTION", label: "Mentions" },
  { id: "APPROVAL_NEEDED", label: "Approvals" },
  { id: "TASK_FINISHED", label: "Task finished" },
  { id: "TASK_FAILED", label: "Task failed" },
  { id: "CONNECTION_NEEDS_RECONNECTING", label: "Connection issues" },
  { id: "SECRET_NOT_WORKING", label: "Secret stopped working" },
  { id: "INVITATION_RECEIVED", label: "Invitations" },
  { id: "AUTOMATION_RESULT", label: "Automation results" },
  { id: "AUTOMATION_PAUSED", label: "Automation paused" },
  { id: "ARTIFACT_SHARED", label: "Artifact shared with me" },
  { id: "ARTIFACT_COMMENT", label: "Comments on my artifacts" },
  { id: "ARTIFACT_EDITED", label: "Edits on my artifacts" },
  { id: "SKILL_SHARED", label: "Skill shared with me" },
  { id: "SKILL_CHANGED", label: "Skill changed" },
  { id: "TAKE_CONTROL_NEEDED", label: "Take control needed" },
  { id: "USAGE_LIMIT", label: "Usage limits" },
  { id: "MODEL_CHANGED", label: "Bot model changed" },
  { id: "EXPORT_READY", label: "Exports ready" },
  { id: "SYSTEM", label: "System" },
] as const;

export const NotificationChannelOptions = [
  { id: "IN_APP", label: "In app" },
  { id: "PUSH", label: "Push" },
  { id: "EMAIL", label: "Email" },
] as const;

export const UsageKindOptions = [
  { id: "MODEL_TOKENS", label: "AI models" },
  { id: "COMPUTER_MINUTES", label: "Cloud computer" },
  { id: "VOICE_MINUTES", label: "Voice" },
  { id: "STORAGE_BYTES", label: "Storage" },
  { id: "ARTIFACT_AI", label: "Artifact AI" },
] as const;

export const ConversationTypeOptions = [
  { id: "DIRECT", label: "Direct" },
  { id: "SHARED_BOT", label: "Shared bot chat" },
  { id: "GROUP", label: "Group" },
] as const;
