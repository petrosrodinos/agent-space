import { create } from "zustand";
import { appLock } from "@/platform/app-lock";

/** The app re-locks when it comes back after being away this long. */
export const AUTO_LOCK_AFTER_MS = 30_000;

interface AppLockStore {
  /** A PIN is set, so the app locks. */
  enabled: boolean;
  biometric: boolean;
  /** The lock screen is showing. Starts locked at launch when a PIN exists. */
  locked: boolean;
  refresh: () => void;
  lock: () => void;
  unlock: () => void;
}

export const useAppLockStore = create<AppLockStore>()((set) => ({
  enabled: appLock.hasPin(),
  biometric: appLock.biometricEnabled(),
  locked: appLock.hasPin(),
  refresh: () => {
    const enabled = appLock.hasPin();
    set((s) => ({ enabled, biometric: enabled && appLock.biometricEnabled(), locked: enabled ? s.locked : false }));
  },
  lock: () => set((s) => (s.enabled ? { locked: true } : s)),
  unlock: () => set({ locked: false }),
}));
