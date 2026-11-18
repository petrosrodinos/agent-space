/**
 * The typed bridge the Electron preload exposes as `window.agentspaceDesktop` (desktop/src/preload.ts mirrors this).
 * Only plain data crosses it; the page never gets Node or Electron objects (§14.2 security).
 */
export interface DesktopBridge {
  readonly version: string;
  readonly os: "win32" | "darwin" | "linux";
  readonly deviceName: string;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
  pickFiles(options: { accept?: string; multiple?: boolean }): Promise<{ name: string; type: string; data: ArrayBuffer }[]>;
  download(url: string, filename?: string): Promise<void>;
  notify(n: { title: string; body?: string; tag?: string }): Promise<void>;
  onNotificationClick(cb: (tag: string | null) => void): () => void;
  clipboardWrite(text: string): Promise<void>;
  clipboardRead(): Promise<string>;
  openExternal(url: string): Promise<void>;
  onNavigate(cb: (path: string) => void): () => void;
  getLaunchAtStartup(): Promise<boolean>;
  setLaunchAtStartup(on: boolean): Promise<void>;
  getQuickAskShortcut(): Promise<string>;
  setQuickAskShortcut(accelerator: string): Promise<boolean>;
  checkForUpdates(): Promise<{ status: "disabled" | "none" | "available" | "downloaded" | "error"; version?: string; message?: string }>;
}

export const getDesktopBridge = (): DesktopBridge | null => (typeof window !== "undefined" ? ((window as unknown as { agentspaceDesktop?: DesktopBridge }).agentspaceDesktop ?? null) : null);
