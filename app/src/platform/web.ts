/* src/platform is the only place allowed to touch browser and native APIs (§14.1); see eslint.config.js. */
import type { Platform } from "./types";

export const APP_VERSION = "1.0.0";

export const browserStorage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function describeBrowser() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Linux";
  return `${browser} on ${os}`;
}

export const webPlatform: Platform = {
  is: (kind) => kind === "web",
  supports: (cap) => {
    switch (cap) {
      case "share":
        return typeof navigator !== "undefined";
      case "notifications":
        return typeof window !== "undefined" && "Notification" in window;
      case "voice":
        return typeof window !== "undefined" && "RTCPeerConnection" in window && !!navigator.mediaDevices;
      case "media":
        return !!navigator.mediaDevices;
      case "push":
        return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
      case "desktop":
        return false;
      default:
        return true;
    }
  },
  storage: {
    ...browserStorage,
    // Web: the refresh token is an httpOnly cookie set by the API; JS never sees it. The access token lives in memory.
    refreshTokenMode: "cookie",
    getRefreshToken: async () => null,
    setRefreshToken: async () => undefined,
  },
  files: {
    pick: (options) =>
      new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        if (options?.accept) input.accept = options.accept;
        input.multiple = !!options?.multiple;
        input.onchange = () => resolve(input.files ? Array.from(input.files) : []);
        input.click();
      }),
    download: (url, filename) => {
      const a = document.createElement("a");
      a.href = url;
      if (filename) a.download = filename;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  },
  share: {
    share: async (data) => {
      if (navigator.share) {
        try {
          await navigator.share(data);
          return "shared";
        } catch {
          return "cancelled";
        }
      }
      await navigator.clipboard.writeText(data.url ?? data.text ?? "");
      return "copied";
    },
  },
  clipboard: {
    writeText: (text) => navigator.clipboard.writeText(text),
    readText: () => navigator.clipboard.readText(),
  },
  notifications: {
    permission: () => ("Notification" in window ? Notification.permission : "unsupported"),
    requestPermission: async () => ("Notification" in window ? Notification.requestPermission() : "unsupported"),
    show: (title, options) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const n = new Notification(title, { body: options?.body, tag: options?.tag });
      if (options?.onClick) n.onclick = () => {
        window.focus();
        options.onClick?.();
        n.close();
      };
    },
    push: {
      supported: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
      current: async () => {
        if (!("serviceWorker" in navigator)) return null;
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        return sub ? { provider: "WEBPUSH" as const, subscription: sub.toJSON() } : null;
      },
      subscribe: async (vapidPublicKey) => {
        if (!vapidPublicKey) throw new Error("Push notifications aren't set up on this server yet.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser's site settings." : "Permission was not given.");
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }));
        return { provider: "WEBPUSH" as const, subscription: sub.toJSON() };
      },
      unsubscribe: async () => {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        await sub?.unsubscribe();
      },
    },
  },
  media: {
    getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
    getCamera: () => navigator.mediaDevices.getUserMedia({ video: true }),
  },
  links: {
    openExternal: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    redirect: (url) => {
      window.location.assign(url);
    },
    returnUrl: (path) => `${window.location.origin}${path}`,
    onDeepLink: () => () => undefined,
  },
  appInfo: { platform: "web", version: APP_VERSION, deviceName: typeof navigator !== "undefined" ? describeBrowser() : "Web" },
  lifecycle: {
    isOnline: () => navigator.onLine,
    isVisible: () => document.visibilityState === "visible",
    onResume: (cb) => {
      const vis = () => document.visibilityState === "visible" && cb();
      const online = () => cb();
      document.addEventListener("visibilitychange", vis);
      window.addEventListener("online", online);
      return () => {
        document.removeEventListener("visibilitychange", vis);
        window.removeEventListener("online", online);
      };
    },
    onOnlineChange: (cb) => {
      const on = () => cb(true);
      const off = () => cb(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    },
  },
};

function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
