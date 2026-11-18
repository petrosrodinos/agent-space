import { Capacitor } from "@capacitor/core";
import type { Platform } from "./types";
import { webPlatform } from "./web";
import { createDesktopPlatform } from "./desktop";
import { getDesktopBridge } from "./desktop-bridge";
import { createNativePlatform } from "./native";

/**
 * The single entry point for platform features (§14.1). The same bundle runs on the web, inside Electron (preload
 * bridge present) and inside Capacitor (native platform) — the implementation is chosen once at start-up.
 */
function selectPlatform(): Platform {
  const bridge = getDesktopBridge();
  if (bridge) return createDesktopPlatform(bridge);
  if (Capacitor.isNativePlatform()) return createNativePlatform();
  return webPlatform;
}

export const platform: Platform = selectPlatform();

/**
 * True inside the desktop (Electron) or mobile (Capacitor) app. Decided by the runtime (preload bridge /
 * `Capacitor.isNativePlatform()`), never by screen width — a narrow browser window is still the web.
 */
export const isAppShell = !platform.is("web");

export type { Platform, PlatformKind, CapabilityName, PushRegistration, DesktopCapability, DesktopUpdateState } from "./types";
export { DesktopUpdateStatus } from "./types";
