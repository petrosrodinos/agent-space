import { useEffect, useRef, useState } from "react";
import { platform, DesktopUpdateStatus, type DesktopUpdateState } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/** Live auto-update state of the desktop app (§14.2). Null outside the desktop app. */
export function useDesktopUpdateState(): DesktopUpdateState | null {
  const desktop = platform.desktop;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  useEffect(() => {
    if (!desktop) return;
    void desktop.getUpdateState().then(setState);
    return desktop.onUpdateState(setState);
  }, [desktop]);
  return state;
}

/** Offers a restart once a background update has finished downloading — once per version. */
export function DesktopUpdateListener() {
  const state = useDesktopUpdateState();
  const announced = useRef<string | null>(null);

  useEffect(() => {
    const desktop = platform.desktop;
    if (!desktop || state?.status !== DesktopUpdateStatus.downloaded || !state.version) return;
    if (announced.current === state.version) return;
    announced.current = state.version;
    toast({
      title: `Agent Space ${state.version} is ready`,
      description: "Restart to update. It also installs the next time you quit.",
      duration: Infinity,
      action: (
        <ToastAction altText="Restart to update" onClick={() => void desktop.installUpdate()}>
          Restart
        </ToastAction>
      ),
    });
  }, [state]);

  return null;
}
