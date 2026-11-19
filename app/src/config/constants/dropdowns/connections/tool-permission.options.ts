import { ToolGroups, ToolPermissions, type ToolPermission } from "@/features/connections/interfaces/connections.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

/** Per-tool permission on the service details page. */
export const ToolPermissionOptions = [
  { id: ToolPermissions.ALWAYS_ALLOW, label: "Always allow", description: "Runs without asking you, even if the bot normally asks first." },
  { id: ToolPermissions.AUTO_REVIEW, label: "Auto-review", description: "Follows the bot's approval level: important actions ask first." },
  { id: ToolPermissions.NEEDS_APPROVAL, label: "Needs approval", description: "Asks you before every use." },
  { id: ToolPermissions.BLOCKED, label: "Blocked", description: "Bots can't use it." },
] as const;

export const ToolGroupOptions = [
  { id: ToolGroups.READ, label: "Reads" },
  { id: ToolGroups.WRITE, label: "Writes" },
] as const;

/** Filter chips above the tool list: every permission plus "All". */
export type ToolPermissionFilter = ToolPermission | typeof ALL_FILTER;
export const ToolPermissionFilterOptions: readonly { id: ToolPermissionFilter; label: string }[] = [{ id: ALL_FILTER, label: "All" }, ...ToolPermissionOptions];
