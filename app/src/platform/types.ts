/**
 * Platform layer (§14.1). Every capability that differs between web, desktop (Electron) and mobile (Capacitor)
 * has an interface here. Feature code calls `platform.supports(...)` and never assumes a feature exists.
 */
export type PlatformKind = "web" | "desktop" | "ios" | "android";

export type CapabilityName = "storage" | "files" | "share" | "clipboard" | "notifications" | "push" | "media" | "voice" | "links" | "appInfo" | "lifecycle" | "desktop";

export interface StorageCapability {
  /** Non-sensitive key/value preferences (selected org, UI state). Sign-in tokens never go here on web. */
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Where the refresh token lives: "cookie" on web (httpOnly), "secure" on native (Keychain/Keystore). */
  refreshTokenMode: "cookie" | "secure";
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
}

export interface FilesCapability {
  pick(options?: { accept?: string; multiple?: boolean }): Promise<File[]>;
  download(url: string, filename?: string): void;
}

export interface ShareCapability {
  share(data: { title?: string; text?: string; url?: string }): Promise<"shared" | "copied" | "cancelled">;
}

export interface ClipboardCapability {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

/** What a device registers for push: a Web Push subscription, or an FCM/APNs device token in the native apps. */
export type PushRegistration = { provider: "WEBPUSH"; subscription: PushSubscriptionJSON } | { provider: "FCM" | "APNS"; token: string };

export interface NotificationsCapability {
  permission(): "granted" | "denied" | "default" | "unsupported";
  requestPermission(): Promise<"granted" | "denied" | "default" | "unsupported">;
  show(title: string, options?: { body?: string; tag?: string; onClick?: () => void }): void;
  /** Push notifications while the app is closed: Web Push on web, APNs/FCM in the native shells. */
  push: {
    supported(): boolean;
    /** The current registration for this device, if push is on. */
    current(): Promise<PushRegistration | null>;
    /** Asks permission if needed and registers. `vapidPublicKey` is only used on web. */
    subscribe(vapidPublicKey: string | null): Promise<PushRegistration>;
    unsubscribe(): Promise<void>;
  };
}

export interface MediaCapability {
  getMicrophone(): Promise<MediaStream>;
  getCamera(): Promise<MediaStream>;
}

export interface LinksCapability {
  /** Open an external link (or an OAuth sign-in window) outside the app. */
  openExternal(url: string): void;
  /** Navigate the whole app to a URL. In the desktop/mobile apps, outside URLs (sign-in pages) open in the system browser. */
  redirect(url: string): void;
  /** A URL that brings the user back to this app at `path` after an outside flow (web origin, or `agentspace://` in the apps). */
  returnUrl(path: string): string;
  /** Deep links (`agentspace://…`, quick-ask, notification taps) → an in-app path to open. */
  onDeepLink(cb: (path: string) => void): () => void;
}

export interface AppInfoCapability {
  platform: PlatformKind;
  version: string;
  deviceName: string;
}

export interface LifecycleCapability {
  isOnline(): boolean;
  isVisible(): boolean;
  /** Fires when the app comes back to the foreground or online — real-time connections resume (§14.1). */
  onResume(cb: () => void): () => void;
  onOnlineChange(cb: (online: boolean) => void): () => void;
}

/** Desktop-only extras (§14.2): launch at start-up, quick-ask shortcut, automatic updates. */
export interface DesktopCapability {
  getLaunchAtStartup(): Promise<boolean>;
  setLaunchAtStartup(on: boolean): Promise<void>;
  getQuickAskShortcut(): Promise<string>;
  /** Electron accelerator, e.g. "CommandOrControl+Shift+Space". Returns false when the shortcut is taken. */
  setQuickAskShortcut(accelerator: string): Promise<boolean>;
  checkForUpdates(): Promise<{ status: "disabled" | "none" | "available" | "downloaded" | "error"; version?: string; message?: string }>;
}

export interface Platform {
  is(kind: PlatformKind): boolean;
  supports(cap: CapabilityName): boolean;
  storage: StorageCapability;
  files: FilesCapability;
  share: ShareCapability;
  clipboard: ClipboardCapability;
  notifications: NotificationsCapability;
  media: MediaCapability;
  links: LinksCapability;
  appInfo: AppInfoCapability;
  lifecycle: LifecycleCapability;
  /** Only in the desktop app. */
  desktop?: DesktopCapability;
}
