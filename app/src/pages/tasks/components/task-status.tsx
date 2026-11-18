import type { FC } from "react";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { RunStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";

const TONE: Record<string, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "working",
  WAITING_APPROVAL: "warning",
  WAITING_INPUT: "warning",
  WAITING_DEVICE: "warning",
  WAITING_COMPUTER: "warning",
  COMPLETED: "success",
  FAILED: "error",
  STOPPED: "neutral",
};

export const TaskStatus: FC<{ status: string }> = ({ status }) => <StatusPill tone={TONE[status] ?? "neutral"}>{getDropdownOptionLabel(RunStatusOptions, status, status)}</StatusPill>;
