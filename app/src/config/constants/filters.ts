/** "No filter" value used by list filters and pickers. */
export const ALL_FILTER = "all";

/** Tasks page filters (map to the API's task status groups). */
export const TaskFilters = { ALL: ALL_FILTER, ACTIVE: "active", WAITING: "waiting", DONE: "done", FAILED: "failed" } as const;
export type TaskFilter = (typeof TaskFilters)[keyof typeof TaskFilters];

/** Approvals page filters. */
export const ApprovalFilters = { PENDING: "pending", ALL: ALL_FILTER } as const;
export type ApprovalFilter = (typeof ApprovalFilters)[keyof typeof ApprovalFilters];

/** Sentinel values for pickers whose real value is "nothing chosen" (null). */
export const PickerValues = { NONE: "none", RECOMMENDED: "recommended", KEEP_WAITING: "keep" } as const;
