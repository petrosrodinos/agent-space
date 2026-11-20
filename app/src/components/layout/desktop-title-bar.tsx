import { useEffect, type FC } from "react";
import { platform } from "@/platform";
import { getDesktopBridge } from "@/platform/desktop-bridge";

/** Height of the custom title bar; keep in sync with TITLEBAR_HEIGHT in desktop/src/main.ts and --titlebar-h in index.css. */
const MAC_TRAFFIC_LIGHTS_INSET = 80;

/**
 * Desktop app only: the window has no native title bar, so this strip (themed like the page) is the drag area.
 * The native minimise/maximise/close buttons overlay its right edge (Windows/Linux) or sit at its left (macOS).
 */
export const DesktopTitleBar: FC = () => {
  const isDesktop = platform.is("desktop");
  useEffect(() => {
    if (!isDesktop) return;
    document.documentElement.dataset.titlebar = "";
    return () => {
      delete document.documentElement.dataset.titlebar;
    };
  }, [isDesktop]);
  if (!isDesktop) return null;
  const mac = getDesktopBridge()?.os === "darwin";
  return (
    <div
      className="titlebar-drag fixed inset-x-0 top-0 z-[300] flex items-center bg-canvas text-xs font-medium text-muted-text select-none"
      style={{ height: "var(--titlebar-h)", paddingLeft: mac ? MAC_TRAFFIC_LIGHTS_INSET : 12 }}
    >
      Agent Space
    </div>
  );
};
