import { useCallback, useState, useSyncExternalStore } from "react";
import { isAppShell, platform, pwa, InstallOutcomes, InstallTargets, type InstallOutcome } from "@/platform";
import { useUiStore } from "@/stores/ui";

const DISMISSED_AT_KEY = "install-banner-dismissed-at";
/** After "Not now", the banner comes back after this long. */
const BANNER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const snoozed = () => {
  const at = Number(platform.storage.get(DISMISSED_AT_KEY) ?? 0);
  return at > 0 && Date.now() - at < BANNER_SNOOZE_MS;
};

/**
 * Installing Agent Space from the browser: one-tap install where the browser supports it (Android Chrome/Edge),
 * otherwise step-by-step "Add to Home Screen" instructions (iPhone/iPad). Never offered inside the desktop/mobile apps.
 */
export function useInstallApp() {
  const installed = useSyncExternalStore(pwa.subscribe, pwa.isInstalled, () => false);
  const canPrompt = useSyncExternalStore(pwa.subscribe, pwa.canPrompt, () => false);
  const setSheetOpen = useUiStore((s) => s.setInstallSheetOpen);
  const [bannerSnoozed, setBannerSnoozed] = useState(snoozed);
  const target = pwa.target();

  const available = !isAppShell && !installed;

  /** Install button: the browser's own prompt when it has one, otherwise our instructions. */
  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (pwa.canPrompt()) return pwa.prompt();
    setSheetOpen(true);
    return InstallOutcomes.UNAVAILABLE;
  }, [setSheetOpen]);

  const dismissBanner = useCallback(() => {
    platform.storage.set(DISMISSED_AT_KEY, String(Date.now()));
    setBannerSnoozed(true);
  }, []);

  return {
    /** The app can be installed from this browser (not already installed, not inside the native/desktop apps). */
    available,
    /** Show the mobile banner: phones/tablets only, and not snoozed. */
    showBanner: available && !bannerSnoozed && target !== InstallTargets.DESKTOP,
    target,
    iosBrowser: pwa.iosBrowser(),
    canPrompt,
    install,
    dismissBanner,
  };
}
