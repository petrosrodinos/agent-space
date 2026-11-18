import type { FC } from "react";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { AutomationRunStatusOptions, AutomationStatusOptions } from "@/config/constants/dropdowns/automations/automation-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import type { AutomationRunStatus, AutomationStatus as Status } from "@/features/automations/interfaces/automations.interfaces";

const STATUS_TONE: Record<Status, StatusTone> = { ACTIVE: "success", PAUSED: "neutral", NEEDS_ATTENTION: "warning" };
const RUN_TONE: Record<AutomationRunStatus, StatusTone> = { QUEUED: "neutral", RUNNING: "working", WAITING_APPROVAL: "warning", SUCCEEDED: "success", FAILED: "error", SKIPPED: "info", STOPPED: "neutral" };

export const AutomationStatus: FC<{ status: Status }> = ({ status }) => <StatusPill tone={STATUS_TONE[status] ?? "neutral"}>{getDropdownOptionLabel(AutomationStatusOptions, status, status)}</StatusPill>;

export const AutomationRunStatusPill: FC<{ status: AutomationRunStatus }> = ({ status }) => <StatusPill tone={RUN_TONE[status] ?? "neutral"}>{getDropdownOptionLabel(AutomationRunStatusOptions, status, status)}</StatusPill>;
