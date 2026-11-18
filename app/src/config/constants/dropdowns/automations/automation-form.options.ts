import { AutomationStatuses, AutomationTabs, ScheduleKinds, type AutomationTab, type ScheduleKind } from "@/features/automations/interfaces/automations.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";
export const AutomationStatusOptions = [
  { id: AutomationStatuses.ACTIVE, label: "Active" },
  { id: AutomationStatuses.PAUSED, label: "Paused" },
  { id: AutomationStatuses.NEEDS_ATTENTION, label: "Needs attention" },
] as const;

export const AutomationStatusFilterOptions = [{ id: ALL_FILTER, label: "All" }, ...AutomationStatusOptions] as const;

export const AutomationRunStatusOptions = [
  { id: "QUEUED", label: "Queued" },
  { id: "RUNNING", label: "Running" },
  { id: "WAITING_APPROVAL", label: "Waiting for approval" },
  { id: "SUCCEEDED", label: "Succeeded" },
  { id: "FAILED", label: "Failed" },
  { id: "SKIPPED", label: "Skipped" },
  { id: "STOPPED", label: "Stopped" },
] as const;

/** Friendly schedule kinds; each maps to a cron expression in the automation's time zone. */
export const ScheduleKindOptions = [
  { id: ScheduleKinds.DAILY, label: "Every day" },
  { id: ScheduleKinds.WEEKDAYS, label: "Every weekday" },
  { id: ScheduleKinds.WEEKLY, label: "Every week" },
  { id: ScheduleKinds.MONTHLY, label: "Every month" },
  { id: ScheduleKinds.HOURLY, label: "Every hour" },
  { id: ScheduleKinds.CUSTOM, label: "Custom" },
] as const;
export type { ScheduleKind };

export const WeekdayOptions = [
  { id: "1", label: "Monday" },
  { id: "2", label: "Tuesday" },
  { id: "3", label: "Wednesday" },
  { id: "4", label: "Thursday" },
  { id: "5", label: "Friday" },
  { id: "6", label: "Saturday" },
  { id: "0", label: "Sunday" },
] as const;

export const AutomationTabOptions = [
  { id: AutomationTabs.OVERVIEW, label: "Overview" },
  { id: AutomationTabs.RUNS, label: "Run history" },
  { id: AutomationTabs.MEMORY, label: "Memory" },
] as const;
export type { AutomationTab };
