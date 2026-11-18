/* Installable web app (PWA). Web only: the desktop and mobile shells are already installed apps (§14.1). */

/** Which install instructions apply to this device. */
export const InstallTargets = { IOS: "ios", ANDROID: "android", DESKTOP: "desktop" } as const;
export type InstallTarget = (typeof InstallTargets)[keyof typeof InstallTargets];

/** Browser families whose iOS "Add to Home Screen" steps differ (where the Share button sits). */
export const IosBrowsers = { SAFARI: "safari", OTHER: "other" } as const;
export type IosBrowser = (typeof IosBrowsers)[keyof typeof IosBrowsers];

export const InstallOutcomes = { ACCEPTED: "accepted", DISMISSED: "dismissed", UNAVAILABLE: "unavailable" } as const;
export type InstallOutcome = (typeof InstallOutcomes)[keyof typeof InstallOutcomes];

/** Chromium's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: typeof InstallOutcomes.ACCEPTED | typeof InstallOutcomes.DISMISSED }>;
}

const SERVICE_WORKER_URL = "/sw.js";
const STANDALONE_QUERY = "(display-mode: standalone)";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function detectTarget(): InstallTarget {
  const ua = navigator.userAgent;
  // iPadOS reports a desktop Safari user agent; touch points give it away.
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOs) return InstallTargets.IOS;
  if (/Android/.test(ua)) return InstallTargets.ANDROID;
  return InstallTargets.DESKTOP;
}

function isStandalone() {
  return window.matchMedia(STANDALONE_QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const pwa = {
  /** Call once at start-up on the web: listens for the install prompt and registers the service worker. */
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault(); // we show our own install button instead of the browser's mini-bar
      deferredPrompt = e as BeforeInstallPromptEvent;
      notify();
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      installed = true;
      notify();
    });
    window.matchMedia(STANDALONE_QUERY).addEventListener("change", notify);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      window.addEventListener("load", () => void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" }).catch(() => undefined));
    }
  },
  target: detectTarget,
  iosBrowser(): IosBrowser {
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent) ? IosBrowsers.OTHER : IosBrowsers.SAFARI;
  },
  /** Already running as an installed app (home screen / dock). */
  isInstalled: () => installed || isStandalone(),
  /** The browser offers a one-tap install (Chrome, Edge, Samsung Internet on Android and desktop). */
  canPrompt: () => !!deferredPrompt,
  async prompt(): Promise<InstallOutcome> {
    const event = deferredPrompt;
    if (!event) return InstallOutcomes.UNAVAILABLE;
    deferredPrompt = null; // the event can only be used once
    await event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    return outcome;
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
