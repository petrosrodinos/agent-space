export const ComputerStatuses = { OFF: "OFF", STARTING: "STARTING", RUNNING: "RUNNING", PAUSED: "PAUSED", ERROR: "ERROR" } as const;
export type ComputerStatus = (typeof ComputerStatuses)[keyof typeof ComputerStatuses];
export const ComputerSessionKinds = { BOT_RUN: "BOT_RUN", USER_EXPLORE: "USER_EXPLORE" } as const;
export type ComputerSessionKind = (typeof ComputerSessionKinds)[keyof typeof ComputerSessionKinds];

export interface ComputerView {
  id: string | null;
  bot_id: string;
  status: ComputerStatus;
  status_message: string | null;
  enabled: boolean;
  available: boolean;
  last_active_at: string | null;
  storage_used_bytes: number;
  total_minutes: number;
  controlled_by: { user_id: string; name: string | null } | null;
}

export interface LiveView {
  url: string;
  token: string;
  expires_at: string;
  control: boolean;
  status: typeof ComputerStatuses.RUNNING;
}

export interface ComputerSession {
  id: string;
  kind: ComputerSessionKind;
  started_at: string;
  ended_at: string | null;
  minutes: number;
  frames: number;
  hidden_ranges: { from: string; to?: string; reason: string }[] | null;
  run: { id: string; title: string | null; conversation_id: string | null } | null;
  user: { id: string; name: string | null } | null;
}

export interface ReplayFrame {
  id: string;
  label: string;
  at: string;
  url: string;
}

export interface ComputerFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string;
}

export interface ComputerFolder {
  path: string;
  entries: ComputerFileEntry[];
}

export interface SignedInWebsite {
  id: string;
  domain: string;
  signed_in_at: string;
  last_seen_at: string;
}

/** What "Clean up" can clear on the computer (mirrors the API's CleanupTargets). */
export const CleanupTargets = { CACHE: "cache", TEMP: "temp", TRASH: "trash", PROGRAMS: "programs" } as const;
export type CleanupTarget = (typeof CleanupTargets)[keyof typeof CleanupTargets];

export interface ComputerProcess {
  pid: number;
  name: string;
  command: string;
  memory_bytes: number;
  cpu_percent: number;
  /** Part of the desktop or Daytona itself; cleanup never ends it. */
  protected: boolean;
}

export interface ComputerLiveStats {
  cpu: { percent: number; cores: number; load: number[] };
  memory: { used_bytes: number; total_bytes: number };
  disk: { used_bytes: number; total_bytes: number; home_bytes: number };
  uptime_seconds: number;
  reclaimable: Record<CleanupTarget, number>;
  processes: ComputerProcess[];
}

export interface ComputerResources {
  allocated: { cpu: number; memory_gb: number; disk_gb: number } | null;
  /** Null unless the computer is running. */
  live: ComputerLiveStats | null;
  checked_at: string;
}

/** Live view: watching (view-only) or in control (§9.2). */
export const ComputerViewModes = { WATCH: "watch", CONTROL: "control" } as const;
export type ComputerViewMode = (typeof ComputerViewModes)[keyof typeof ComputerViewModes];
