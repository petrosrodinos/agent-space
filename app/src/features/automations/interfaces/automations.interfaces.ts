import type { ActionType } from "@/features/bots/interfaces/bots.interfaces";
import type { RunStatus } from "@/features/tasks/interfaces/tasks.interfaces";

export const AutomationStatuses = { ACTIVE: "ACTIVE", PAUSED: "PAUSED", NEEDS_ATTENTION: "NEEDS_ATTENTION" } as const;
export type AutomationStatus = (typeof AutomationStatuses)[keyof typeof AutomationStatuses];
export const AutomationRunStatuses = { QUEUED: "QUEUED", RUNNING: "RUNNING", WAITING_APPROVAL: "WAITING_APPROVAL", SUCCEEDED: "SUCCEEDED", FAILED: "FAILED", SKIPPED: "SKIPPED", STOPPED: "STOPPED" } as const;
export type AutomationRunStatus = (typeof AutomationRunStatuses)[keyof typeof AutomationRunStatuses];
export const ResultDestinationKinds = { CONVERSATION: "CONVERSATION", EMAIL: "EMAIL", CONNECTION: "CONNECTION" } as const;
export type ResultDestinationKind = (typeof ResultDestinationKinds)[keyof typeof ResultDestinationKinds];
export const AutomationTriggerKinds = { SCHEDULE: "SCHEDULE", COMPOSIO_TRIGGER: "COMPOSIO_TRIGGER", PLACE: "PLACE" } as const;
export type AutomationTriggerKind = (typeof AutomationTriggerKinds)[keyof typeof AutomationTriggerKinds];

export interface AutomationConnection {
  id: string;
  label: string;
  service_name: string;
  service_key: string;
  status: string;
  deleted_at: string | null;
}

export interface AutomationPreApproval {
  id: string;
  action_type: ActionType;
  connection_id: string | null;
  connection: { id: string; label: string; service_name: string } | null;
  target: string;
  created_at: string;
}

export interface AutomationResultDestination {
  id: string;
  kind: ResultDestinationKind;
  conversation_id: string | null;
  email: string | null;
  connection_id: string | null;
  connection: { id: string; label: string; service_name: string } | null;
  target: string | null;
}

export interface Automation {
  id: string;
  name: string;
  instructions: string;
  status: AutomationStatus;
  status_reason: string | null;
  trigger_kind: AutomationTriggerKind;
  cron_expression: string | null;
  timezone: string | null;
  schedule_description: string | null;
  /** Set when an event in a connected account starts it (§10.2). */
  trigger: AutomationTriggerInfo | null;
  uses_cloud_computer: boolean;
  memory_plan: string | null;
  memory_size: number;
  consecutive_failures: number;
  next_run_at: string | null;
  last_run_at: string | null;
  run_count: number;
  pre_approvals_confirmed_at: string | null;
  results_conversation_id: string | null;
  results_conversation: { id: string; name: string | null; type: string } | null;
  source_conversation_id: string | null;
  bot: { id: string; name: string; emoji: string; color: string; deleted_at: string | null };
  skill: { id: string; name: string; emoji: string | null; slug: string } | null;
  connections: AutomationConnection[];
  pre_approvals: AutomationPreApproval[];
  result_destinations: AutomationResultDestination[];
  last_run?: { id: string; status: AutomationRunStatus; created_at: string; finished_at: string | null } | null;
  is_running?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  status: AutomationRunStatus;
  attempt: number;
  is_retry: boolean;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  result_summary: string | null;
  error: string | null;
  created_at: string;
  run: { id: string; status: RunStatus; conversation_id: string | null; cost: number; error: string | null; _count: { steps: number } } | null;
}

export interface AutomationMemory {
  notes: Record<string, unknown>;
  plan: string | null;
  files: { id: string; filename: string; mimetype: string; size: number; created_at: string }[];
  size: number;
  max_size: number;
}

export interface PreApprovalInput {
  action_type: ActionType;
  connection_id?: string | null;
  target: string;
}

/** §16 Meeting assistant: briefs before meetings and follow-up drafts after (two automations). */
export interface MeetingAssistantStatus {
  enabled: boolean;
  config: { bot_id: string; calendar_connection_id: string; email_connection_id: string | null; briefs_automation_id: string | null; follow_ups_automation_id: string | null } | null;
  briefs: { id: string; name: string; status: AutomationStatus; last_run_at: string | null; next_run_at: string | null } | null;
  follow_ups: { id: string; name: string; status: AutomationStatus; last_run_at: string | null; next_run_at: string | null } | null;
}

export interface MeetingAssistantInput {
  bot_id: string;
  calendar_connection_id: string;
  email_connection_id: string | null;
  briefs: boolean;
  follow_ups: boolean;
}

/** How an automation starts (§10.2): on a schedule, or when an event happens in a connected account. */
export const AutomationStartKinds = { SCHEDULE: "schedule", EVENT: "event" } as const;
export type AutomationStartKind = (typeof AutomationStartKinds)[keyof typeof AutomationStartKinds];

/** An event a connected account can start an automation with (Composio trigger type). */
export interface AutomationTriggerType {
  slug: string;
  name: string;
  description: string;
  /** JSON schema of the event's settings. */
  config: { properties?: Record<string, { type?: string; title?: string; description?: string; default?: unknown }>; required?: string[] };
}

export interface AutomationTriggerInput {
  connection_id: string;
  trigger_slug: string;
  config?: Record<string, unknown>;
}

export interface AutomationTriggerInfo {
  slug: string;
  name: string | null;
  config: Record<string, unknown> | null;
  connection: { id: string; label: string; service_name: string; service_key: string };
}

export interface AutomationInput {
  name: string;
  bot_id: string;
  instructions: string;
  /** A schedule, or… */
  cron_expression?: string;
  /** …an event that starts each run. */
  trigger?: AutomationTriggerInput;
  timezone?: string;
  skill_id?: string | null;
  connection_ids?: string[];
  pre_approvals?: PreApprovalInput[];
  memory_plan?: string | null;
  uses_cloud_computer?: boolean;
  email_results?: boolean;
}

export type AutomationUpdate = Partial<Omit<AutomationInput, "bot_id">> & { bot_id?: string };

/** Friendly schedule kinds; each maps to a cron expression in the automation's time zone. */
export const ScheduleKinds = { DAILY: "daily", WEEKDAYS: "weekdays", WEEKLY: "weekly", MONTHLY: "monthly", HOURLY: "hourly", CUSTOM: "custom" } as const;
export type ScheduleKind = (typeof ScheduleKinds)[keyof typeof ScheduleKinds];

export const AutomationTabs = { OVERVIEW: "overview", RUNS: "runs", MEMORY: "memory" } as const;
export type AutomationTab = (typeof AutomationTabs)[keyof typeof AutomationTabs];

/** Cron "any value" field. */
export const CRON_ANY = "*";
/** Cron day-of-week range for Monday–Friday. */
export const CRON_WEEKDAYS = "1-5";
