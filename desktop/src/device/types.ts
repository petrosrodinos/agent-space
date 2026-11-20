/**
 * Device tools contract (§14.3). Copy of app/src/platform/device-bridge.ts (the source of truth); keep both in sync.
 * The desktop build cannot import from app/, so the types are duplicated here unchanged.
 */

/** Mirrors the API's DeviceToolKind (desktop subset). */
export const DesktopToolKinds = {
  LOCAL_FILES: "LOCAL_FILES",
  SCREEN: "SCREEN",
  LOCAL_TOOL_SERVERS: "LOCAL_TOOL_SERVERS",
  CLIPBOARD: "CLIPBOARD",
  OPEN: "OPEN",
  CONTROL_COMPUTER: "CONTROL_COMPUTER",
} as const;
export type DesktopToolKind = (typeof DesktopToolKinds)[keyof typeof DesktopToolKinds];

export const LocalFileActions = { LIST: "list", SEARCH: "search", READ: "read", WRITE: "write", MOVE: "move", DELETE: "delete" } as const;
export type LocalFileAction = (typeof LocalFileActions)[keyof typeof LocalFileActions];

/** One request to the local files tool. Paths are absolute or relative to an allowed folder; main resolves and checks them. */
export interface LocalFilesRequest {
  action: LocalFileAction;
  /** list/read/write/delete: the target. move: the source. Empty for list = the allowed folders themselves. */
  path?: string;
  /** move: destination path (also used to rename). */
  to?: string;
  /** search: text matched against file names (case-insensitive), searched recursively in allowed folders. */
  query?: string;
  /** write: file content. */
  content?: string;
  /** write: "utf8" (default) or "base64" for binary content. */
  encoding?: "utf8" | "base64";
  /** write: replace an existing file. Without it, writing over an existing file fails. */
  overwrite?: boolean;
}

export interface LocalFileEntry {
  path: string;
  name: string;
  kind: "file" | "folder";
  size: number;
  modified: string;
}

export type LocalFilesResult =
  | { action: "list" | "search"; entries: LocalFileEntry[]; truncated: boolean }
  | { action: "read"; path: string; size: number; mimetype: string; encoding: "utf8" | "base64"; content: string; truncated: boolean }
  | { action: "write" | "move" | "delete"; ok: true; path: string };

export interface ScreenSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  /** Small preview, data URL (PNG). */
  thumbnail: string;
}

export interface CapturedImage {
  /** data:image/png;base64,… */
  dataUrl: string;
  width: number;
  height: number;
}

export interface LocalToolServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  /** Environment variable names; values are kept encrypted in the main process and never returned. */
  envKeys: string[];
  enabled: boolean;
}

export interface LocalToolServerInput {
  id?: string;
  name: string;
  command: string;
  args: string[];
  /** Values to store for this server's variables. Omitted keys keep their stored value; empty string removes it. */
  env?: Record<string, string>;
  enabled: boolean;
}

export interface LocalTool {
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface DisplayInfo {
  id: string;
  label: string;
  width: number;
  height: number;
  primary: boolean;
}

export const ControlActions = {
  SCREENSHOT: "screenshot",
  CLICK: "click",
  DOUBLE_CLICK: "double_click",
  RIGHT_CLICK: "right_click",
  MOVE: "move",
  DRAG: "drag",
  TYPE: "type",
  KEY: "key",
  SCROLL: "scroll",
  WAIT: "wait",
} as const;
export type ControlAction = (typeof ControlActions)[keyof typeof ControlActions];

/** Coordinates are in screenshot pixels (the screenshot is scaled to at most 1280 px wide); main maps them back. */
export interface ControlRequest {
  action: ControlAction;
  x?: number;
  y?: number;
  to_x?: number;
  to_y?: number;
  text?: string;
  /** key: e.g. "Enter", "Tab", "ctrl+c", "cmd+shift+t". */
  keys?: string;
  /** scroll: lines; positive = down. */
  amount?: number;
  /** wait: milliseconds (max 5000). */
  ms?: number;
}

export interface ControlResult {
  ok: boolean;
  /** Screenshot after the action (always included). */
  screenshot: CapturedImage;
  /** The app in front after the action. */
  frontApp: string | null;
  /** Set when the action was refused (blocked app, paused, expired…). */
  error?: string;
}

export const ControlStates = { RUNNING: "running", PAUSED: "paused", STOPPED: "stopped", EXPIRED: "expired" } as const;
export type ControlState = (typeof ControlStates)[keyof typeof ControlStates];

export interface ControlEvent {
  grantId: string;
  state: ControlState;
  /** Why it changed: "user_input", "stop_shortcut", "stop_button", "pause_button", "hand_back", "expired", "blocked_app". */
  reason: string;
}

export interface DeviceBridge {
  /** Which device tools this build and OS support (e.g. no CONTROL_COMPUTER when the input library failed to load). */
  capabilities(): Promise<DesktopToolKind[]>;

  // Allowed folders (§14.3 Local files): only added through the OS folder picker in main.
  listFolders(): Promise<string[]>;
  addFolder(): Promise<string[]>;
  removeFolder(path: string): Promise<string[]>;
  files(req: LocalFilesRequest): Promise<LocalFilesResult>;

  // Look at my screen: the app shows the picker built from these sources; nothing is captured until the user picks.
  screenSources(): Promise<ScreenSource[]>;
  captureSource(sourceId: string): Promise<CapturedImage>;

  // Open files (inside allowed folders), links (http/https/mailto) and apps (by name).
  open(req: { kind: "url" | "path" | "app"; target: string }): Promise<{ ok: true }>;

  // Local tool servers (MCP over stdio), private to this computer.
  listToolServers(): Promise<LocalToolServerConfig[]>;
  saveToolServer(input: LocalToolServerInput): Promise<LocalToolServerConfig[]>;
  removeToolServer(id: string): Promise<LocalToolServerConfig[]>;
  /** Starts enabled servers if needed and lists their tools. */
  listLocalTools(): Promise<LocalTool[]>;
  callLocalTool(serverId: string, tool: string, args: Record<string, unknown>): Promise<unknown>;

  // Control my computer (§14.3).
  displays(): Promise<DisplayInfo[]>;
  getBlockedApps(): Promise<{ builtIn: string[]; extra: string[] }>;
  setBlockedApps(extra: string[]): Promise<{ builtIn: string[]; extra: string[] }>;
  /** Called after the user tapped Allow in the app's card: shows the border and bar, starts watching input. */
  beginControl(req: { grantId: string; displayId: string; botName: string; task: string; expiresAt: number }): Promise<{ ok: true }>;
  control(grantId: string, req: ControlRequest): Promise<ControlResult>;
  /** Hand control back to the bot after the user paused it. */
  resumeControl(grantId: string): Promise<{ ok: true }>;
  endControl(grantId: string): Promise<{ ok: true }>;
  onControlEvent(cb: (e: ControlEvent) => void): () => void;
}
