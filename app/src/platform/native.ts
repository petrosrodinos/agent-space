import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { Platform, PushRegistration } from "./types";
import { browserStorage, webPlatform, APP_VERSION } from "./web";

const REFRESH_KEY = "agentspace.refresh_token";
const PUSH_KEY = "agentspace.push_token";
const APP_SCHEME = "agentspace://";

/** `agentspace://c/123?x=1` or a universal link `https://app…/c/123` → `/c/123?x=1`. */
function toPath(url: string): string | null {
  try {
    if (url.startsWith(APP_SCHEME)) return `/${url.slice(APP_SCHEME.length).replace(/^\/+/, "")}`;
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/**
 * Mobile (Capacitor) platform (§14.2): the bundled web app plus native plugins. The refresh token lives in the
 * iOS Keychain / Android Keystore; push uses APNs/FCM device tokens; outside pages open in the system browser.
 */
export function createNativePlatform(): Platform {
  const kind = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  const deepLinkListeners = new Set<(path: string) => void>();
  const emit = (path: string | null) => path && deepLinkListeners.forEach((cb) => cb(path));

  void App.addListener("appUrlOpen", ({ url }) => emit(toPath(url)));
  void PushNotifications.addListener("pushNotificationActionPerformed", (a) => emit((a.notification.data?.url as string | undefined) ?? "/"));
  void LocalNotifications.addListener("localNotificationActionPerformed", (a) => emit((a.notification.extra?.url as string | undefined) ?? null));

  const pushToken = async () => (await SecureStorage.get(PUSH_KEY).catch(() => null)) as string | null;

  return {
    ...webPlatform,
    is: (k) => k === kind,
    supports: (cap) => (cap === "push" ? true : cap === "desktop" ? false : webPlatform.supports(cap)),
    storage: {
      ...browserStorage,
      refreshTokenMode: "secure",
      getRefreshToken: async () => ((await SecureStorage.get(REFRESH_KEY).catch(() => null)) as string | null) ?? null,
      setRefreshToken: async (token) => {
        if (token) await SecureStorage.set(REFRESH_KEY, token);
        else await SecureStorage.remove(REFRESH_KEY).catch(() => undefined);
      },
    },
    files: {
      ...webPlatform.files,
      download: (url) => void Browser.open({ url }),
    },
    share: {
      share: async (data) => {
        try {
          await Share.share({ title: data.title, text: data.text, url: data.url });
          return "shared";
        } catch {
          return "cancelled";
        }
      },
    },
    clipboard: {
      writeText: (text) => Clipboard.write({ string: text }),
      readText: async () => (await Clipboard.read()).value,
    },
    notifications: {
      permission: () => "default",
      requestPermission: async () => {
        const r = await LocalNotifications.requestPermissions();
        return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "default";
      },
      show: (title, options) => {
        void LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2 ** 31), title, body: options?.body ?? "" }] });
      },
      push: {
        supported: () => true,
        current: async () => {
          const token = await pushToken();
          return token ? { provider: kind === "ios" ? "APNS" : "FCM", token } : null;
        },
        subscribe: async () => {
          const perm = await PushNotifications.requestPermissions();
          if (perm.receive !== "granted") throw new Error("Notifications are turned off for Agent Space. Turn them on in the phone's Settings.");
          const token = await new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Push registration timed out")), 20_000);
            void PushNotifications.addListener("registration", (t) => {
              clearTimeout(timer);
              resolve(t.value);
            });
            void PushNotifications.addListener("registrationError", (e) => {
              clearTimeout(timer);
              reject(new Error(e.error));
            });
            void PushNotifications.register();
          });
          await SecureStorage.set(PUSH_KEY, token);
          return { provider: kind === "ios" ? "APNS" : "FCM", token } satisfies PushRegistration;
        },
        unsubscribe: async () => {
          await PushNotifications.unregister().catch(() => undefined);
          await SecureStorage.remove(PUSH_KEY).catch(() => undefined);
        },
      },
    },
    links: {
      openExternal: (url) => void Browser.open({ url }),
      redirect: (url) => (url.startsWith(window.location.origin) || url.startsWith("/") ? window.location.assign(url) : void Browser.open({ url })),
      returnUrl: (path) => `${APP_SCHEME}${path.replace(/^\//, "")}`,
      onDeepLink: (cb) => {
        deepLinkListeners.add(cb);
        return () => {
          deepLinkListeners.delete(cb);
        };
      },
    },
    appInfo: { platform: kind, version: APP_VERSION, deviceName: kind === "ios" ? "iPhone" : "Android phone" },
    lifecycle: {
      ...webPlatform.lifecycle,
      onResume: (cb) => {
        const h = App.addListener("appStateChange", (s) => s.isActive && cb());
        const off = webPlatform.lifecycle.onResume(cb);
        return () => {
          void h.then((x) => x.remove());
          off();
        };
      },
    },
  };
}

/** Closes the in-app browser when a sign-in flow returns through a deep link. */
export const closeExternalBrowser = () => Browser.close().catch(() => undefined);
