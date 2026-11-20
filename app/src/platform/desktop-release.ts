import { environments } from "@/config/environments";

/** Published by desktop/scripts/release.mjs and served by the API (api/src/modules/desktop-releases). */
export const DESKTOP_RELEASES_URL = `${environments.API_URL}/desktop/releases`;
export const DESKTOP_WINDOWS_INSTALLER_URL = `${DESKTOP_RELEASES_URL}/download/AgentSpace-Setup.exe`;
export const DESKTOP_MAC_INSTALLER_URL = `${DESKTOP_RELEASES_URL}/download/AgentSpace.dmg`;

export const DesktopOses = { WINDOWS: "windows", MAC: "mac", OTHER: "other" } as const;
export type DesktopOs = (typeof DesktopOses)[keyof typeof DesktopOses];

export function detectDesktopOs(): DesktopOs {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return DesktopOses.WINDOWS;
  if (/Macintosh/.test(ua)) return DesktopOses.MAC;
  return DesktopOses.OTHER;
}
