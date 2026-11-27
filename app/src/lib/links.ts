import { environments } from "@/config/environments";

/**
 * Path inside this app for a link, or null when it points elsewhere. Bots write links as absolute web URLs
 * (VITE_APP_URL) or plain paths; the desktop and phone apps run on a different origin, so these must be routed
 * in-app instead of being handed to the browser.
 */
export function inAppPath(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (!environments.APP_URL) return null;
  try {
    const url = new URL(href);
    if (url.origin !== new URL(environments.APP_URL).origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
