import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import type { Platform, PushRegistration } from "./types";
import { browserStorage, webPlatform, APP_VERSION } from "./web";
import { AgentSpaceNative, isAgentSpaceNativeAvailable, type NativeSessionInput, type TaskProgressEnd, type TaskProgressInput } from "./mobile-native";
import { emitAssistantIntent, parseAssistantPath } from "./mobile-assistant";
import { initShareTarget } from "./mobile-share";

export { nativeVoice } from "./mobile-voice";

/** Legacy (pre-native-session) location of the refresh token; migrated into the AgentSpace plugin's store on first read. */
const REFRESH_KEY = "agentspace.refresh_token";
const PUSH_KEY = "agentspace.push_token";
const APP_SCHEME = "agentspace://";

/**
 * Refresh token storage. Builds with the AgentSpace plugin keep it in the native session store (Android Keystore),
 * shared with the lock-screen approval actions and widgets so there's only one copy of a rotating token. Older native
 * builds running a newer web bundle fall back to SecureStorage.
 */
async function readRefreshToken(): Promise<string | null> {
  const legacy = async () => ((await SecureStorage.get(REFRESH_KEY).catch(() => null)) as string | null) ?? null;
  if (!isAgentSpaceNativeAvailable()) return legacy();
  const token = (await AgentSpaceNative.getRefreshToken().catch(() => ({ token: undefined }))).token ?? null;
  if (token) return token;
  const old = await legacy();
  if (old) {
    await AgentSpaceNative.setRefreshToken({ token: old })
      .then(() => SecureStorage.remove(REFRESH_KEY))
      .catch(() => undefined);
  }
  return old;
}

async function writeRefreshToken(token: string | null) {
  if (!isAgentSpaceNativeAvailable()) {
    if (token) await SecureStorage.set(REFRESH_KEY, token);
    else await SecureStorage.remove(REFRESH_KEY).catch(() => undefined);
    return;
  }
  await AgentSpaceNative.setRefreshToken({ token });
  if (!token) {
    await SecureStorage.remove(REFRESH_KEY).catch(() => undefined);
    // Signed out: forget the mirrored session too, so widgets and notification actions stop using it.
    await AgentSpaceNative.clearSession().catch(() => undefined);
  }
}

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
 * Android Keystore; push uses FCM device tokens; outside pages open in the system browser. Android only.
 */
export function createNativePlatform(): Platform {
  const kind = "android" as const;
  const deepLinkListeners = new Set<(path: string) => void>();
  const emit = (path: string | null) => {
    if (!path) return;
    // Google Assistant / widget / shortcut actions aren't routes: the mobile host resolves them (mobile-assistant.ts).
    const intent = parseAssistantPath(path);
    if (intent) emitAssistantIntent(intent);
    else deepLinkListeners.forEach((cb) => cb(path));
  };
  initShareTarget();

  void App.addListener("appUrlOpen", ({ url }) => emit(toPath(url)));
  void PushNotifications.addListener("pushNotificationActionPerformed", (a) => emit((a.notification.data?.url as string | undefined) ?? "/"));
  void LocalNotifications.addListener("localNotificationActionPerformed", (a) => emit((a.notification.extra?.url as string | undefined) ?? null));

  const pushToken = async () => (await SecureStorage.get(PUSH_KEY).catch(() => null)) as string | null;

  return {
    ...webPlatform,
    is: (k) => k === kind,
    supports: (cap) => (cap === "push" ? true : cap === "desktop" ? false : webPlatform.supports(cap)),
    // No screen sharing on phones (§7.6); the camera works.
    media: { ...webPlatform.media, getScreen: () => null, canShareScreen: () => false },
    storage: {
      ...browserStorage,
      refreshTokenMode: "secure",
      getRefreshToken: readRefreshToken,
      setRefreshToken: writeRefreshToken,
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
          return token ? { provider: "FCM", token } : null;
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
          return { provider: "FCM", token } satisfies PushRegistration;
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
    appInfo: { platform: kind, version: APP_VERSION, deviceName: "Android phone" },
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

/** Outcome of a biometric check. */
export const BiometricResults = {
  VERIFIED: "verified",
  /** Cancelled, failed or locked out: don't approve. */
  FAILED: "failed",
  /** No fingerprint / face / screen lock set up (or not the Android app): explain, and don't approve on this device. */
  UNAVAILABLE: "unavailable",
} as const;
export type BiometricResult = (typeof BiometricResults)[keyof typeof BiometricResults];

/**
 * Fingerprint / face unlock for sensitive approvals (§11, §13.4 biometric approval scopes; §14.2). Android only.
 *
 * Where to call it: the approval UI (pages/chat/components/approval-card.tsx and the approvals pages under
 * pages/approvals) — before calling resolveApproval(id, { decision: "approve" }) for an approval with
 * `requires_biometric: true` while `platform.is("android")`:
 *   const r = await nativeBiometric.verify(`Approve: ${approval.summary}`);
 *   if (r !== BiometricResults.VERIFIED) return; // show a message for UNAVAILABLE
 * Rejecting never needs it. Lock-screen notifications for these approvals have no buttons; tapping opens the app.
 */
export const nativeBiometric = {
  available: async (): Promise<boolean> => {
    const r = await BiometricAuth.checkBiometry().catch(() => null);
    return !!r && (r.isAvailable || r.deviceIsSecure);
  },
  verify: async (reason: string): Promise<BiometricResult> => {
    if (!(await nativeBiometric.available())) return BiometricResults.UNAVAILABLE;
    try {
      await BiometricAuth.authenticate({ reason, androidTitle: "Confirm it's you", androidSubtitle: reason, cancelTitle: "Cancel", allowDeviceCredential: true });
      return BiometricResults.VERIFIED;
    } catch {
      return BiometricResults.FAILED;
    }
  },
};

/**
 * Live progress of long tasks in an ongoing notification (§14.2: "Researching… 12 of 30 done" on the lock screen).
 * Android only; no-ops elsewhere. Call from the tasks UI while a task runs, e.g. on each run progress event:
 *   nativeProgress.update({ id: run.id, title: "Researching…", text: "12 of 30 done", progress: 12, max: 30, url: Routes.tasks.detail(run.id) });
 *   nativeProgress.end({ id: run.id, title: "Research finished", url: Routes.tasks.detail(run.id) }); // or end({ id }) to just remove it
 */
export const nativeProgress = {
  update: async (p: TaskProgressInput): Promise<boolean> => (isAgentSpaceNativeAvailable() ? (await AgentSpaceNative.showProgress(p).catch(() => ({ shown: false }))).shown : false),
  end: async (p: TaskProgressEnd): Promise<void> => {
    if (isAgentSpaceNativeAvailable()) await AgentSpaceNative.endProgress(p).catch(() => undefined);
  },
};

/**
 * Mirrors the signed-in session to the native store (API URL, organisation, current access token) so lock-screen
 * Approve / Reject and the approvals widget can call the API while the app is closed. Called by the mobile host.
 */
export const syncNativeSession = async (s: NativeSessionInput) => {
  if (!isAgentSpaceNativeAvailable()) return;
  await AgentSpaceNative.setSession(s).catch(() => undefined);
};

/** Asks the approvals widget to refresh its count now (after approving/rejecting in the app). */
export const refreshNativeWidgets = async () => {
  if (isAgentSpaceNativeAvailable()) await AgentSpaceNative.refreshWidgets().catch(() => undefined);
};
