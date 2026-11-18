import type { Platform } from "./types";
import type { DesktopBridge } from "./desktop-bridge";
import { browserStorage, webPlatform } from "./web";

const APP_SCHEME = "agentspace://";

/**
 * Desktop (Electron) platform (§14.2): the web app plus native features through the preload bridge.
 * The refresh token is kept by the main process, encrypted with the OS keychain (safeStorage).
 */
export function createDesktopPlatform(bridge: DesktopBridge): Platform {
  const clickHandlers = new Map<string, () => void>();
  bridge.onNotificationClick((tag) => {
    if (!tag) return;
    clickHandlers.get(tag)?.();
    clickHandlers.delete(tag);
  });
  const isAppUrl = (url: string) => url.startsWith(window.location.origin) || url.startsWith("/");

  return {
    ...webPlatform,
    is: (kind) => kind === "desktop",
    supports: (cap) => (cap === "push" ? false : cap === "desktop" ? true : webPlatform.supports(cap)),
    storage: {
      ...browserStorage,
      refreshTokenMode: "secure",
      getRefreshToken: () => bridge.getRefreshToken(),
      setRefreshToken: (token) => bridge.setRefreshToken(token),
    },
    files: {
      pick: async (options) => {
        const picked = await bridge.pickFiles(options ?? {});
        return picked.map((f) => new File([f.data], f.name, { type: f.type }));
      },
      download: (url, filename) => void bridge.download(url, filename),
    },
    share: {
      share: async (data) => {
        await bridge.clipboardWrite(data.url ?? data.text ?? "");
        return "copied";
      },
    },
    clipboard: { writeText: (t) => bridge.clipboardWrite(t), readText: () => bridge.clipboardRead() },
    notifications: {
      permission: () => "granted",
      requestPermission: async () => "granted",
      show: (title, options) => {
        const tag = options?.tag ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (options?.onClick) clickHandlers.set(tag, options.onClick);
        void bridge.notify({ title, body: options?.body, tag });
      },
      // Desktop shows notifications while the app runs (it starts with the computer); Web Push isn't available in Electron.
      push: {
        supported: () => false,
        current: async () => null,
        subscribe: async () => {
          throw new Error("The desktop app shows notifications while it's running.");
        },
        unsubscribe: async () => undefined,
      },
    },
    links: {
      openExternal: (url) => void bridge.openExternal(url),
      // Outside pages (sign-in, connection consent) open in the system browser and come back through agentspace:// (§14.2).
      redirect: (url) => (isAppUrl(url) ? window.location.assign(url) : void bridge.openExternal(url)),
      returnUrl: (path) => `${APP_SCHEME}${path.replace(/^\//, "")}`,
      onDeepLink: (cb) => bridge.onNavigate(cb),
    },
    appInfo: { platform: "desktop", version: bridge.version, deviceName: bridge.deviceName },
    desktop: {
      getLaunchAtStartup: () => bridge.getLaunchAtStartup(),
      setLaunchAtStartup: (on) => bridge.setLaunchAtStartup(on),
      getQuickAskShortcut: () => bridge.getQuickAskShortcut(),
      setQuickAskShortcut: (a) => bridge.setQuickAskShortcut(a),
      checkForUpdates: () => bridge.checkForUpdates(),
    },
  };
}
