import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";

export const RunStatuses = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  WAITING_INPUT: "WAITING_INPUT",
  WAITING_DEVICE: "WAITING_DEVICE",
  WAITING_COMPUTER: "WAITING_COMPUTER",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  STOPPED: "STOPPED",
} as const;
export type RunStatus = (typeof RunStatuses)[keyof typeof RunStatuses];

export const ACTIVE_RUN_STATUSES: RunStatus[] = [RunStatuses.QUEUED, RunStatuses.RUNNING];
export const WAITING_RUN_STATUSES: RunStatus[] = [RunStatuses.WAITING_APPROVAL, RunStatuses.WAITING_INPUT, RunStatuses.WAITING_DEVICE, RunStatuses.WAITING_COMPUTER];

export const RunTypes = { CHAT_REPLY: "CHAT_REPLY", TASK: "TASK", AUTOMATION_RUN: "AUTOMATION_RUN", BOT_TO_BOT: "BOT_TO_BOT" } as const;
export type RunType = (typeof RunTypes)[keyof typeof RunTypes];
export const RunStepStatuses = { RUNNING: "RUNNING", COMPLETED: "COMPLETED", FAILED: "FAILED", SKIPPED: "SKIPPED" } as const;
export type RunStepStatus = (typeof RunStepStatuses)[keyof typeof RunStepStatuses];
export const ApprovalStatuses = { PENDING: "PENDING", APPROVED: "APPROVED", EDITED_APPROVED: "EDITED_APPROVED", REJECTED: "REJECTED", CANCELLED: "CANCELLED", EXPIRED: "EXPIRED" } as const;
export const ApprovalDecisions = { APPROVE: "approve", REJECT: "reject" } as const;
export type ApprovalDecision = (typeof ApprovalDecisions)[keyof typeof ApprovalDecisions];
/** Approved outcomes (as typed or after edits). */

export type ApprovalStatus = (typeof ApprovalStatuses)[keyof typeof ApprovalStatuses];


export interface Task {
  id: string;
  type: RunType;
  status: RunStatus;
  title: string;
  bot: BotBrief;
  conversation: { id: string; name: string | null; type: string } | null;
  model: { name: string } | null;
  error: string | null;
  steps: number;
  pending_approvals: number;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunStep {
  id: string;
  sequence: number;
  type: string;
  status: RunStepStatus;
  title: string;
  tool_name: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface TaskDetail extends Omit<Task, "steps"> {
  steps: RunStep[];
  approvals: Approval[];
  model: { name: string; openrouter_id: string } | null;
}

export interface Approval {
  id: string;
  run_id: string;
  conversation_id: string | null;
  bot: BotBrief;
  conversation?: { id: string; name: string | null; type?: string } | null;
  action_type: string;
  title: string;
  preview: Record<string, unknown>;
  status: ApprovalStatus;
  requires_tap: boolean;
  /** Fingerprint / face unlock needed to approve on the phone (§13.4). */
  requires_biometric: boolean;
  is_urgent: boolean;
  timeout_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** Approved outcomes (as typed or after edits). */
export const APPROVED_STATUSES: string[] = [ApprovalStatuses.APPROVED, ApprovalStatuses.EDITED_APPROVED];
