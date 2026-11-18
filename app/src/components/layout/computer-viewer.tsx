import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hand, Maximize2, Minimize2, MonitorPlay, MousePointerClick, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useComputer } from "@/features/computers/hooks/use-computers";
import { getLiveView, handBack, takeControl } from "@/features/computers/services/computers.services";
import type { ComputerStatus, LiveView } from "@/features/computers/interfaces/computers.interfaces";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QueryKeys } from "@/config/constants/query-keys";
import { ComputerStatuses, ComputerViewModes, type ComputerViewMode } from "@/features/computers/interfaces/computers.interfaces";
import { ComputerStatusOptions } from "@/config/constants/dropdowns/computers/computer.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";

/** Status pill colour per computer status (labels come from ComputerStatusOptions). */
export const COMPUTER_STATUS_TONE: Record<ComputerStatus, StatusTone> = {
  [ComputerStatuses.OFF]: "neutral",
  [ComputerStatuses.STARTING]: "working",
  [ComputerStatuses.RUNNING]: "success",
  [ComputerStatuses.PAUSED]: "info",
  [ComputerStatuses.ERROR]: "error",
};
const BusyActions = { OPEN: "open", TAKE: "take", BACK: "back" } as const;
type BusyAction = (typeof BusyActions)[keyof typeof BusyActions];

interface Props {
  botId: string;
  /** CONTROL takes control as soon as the computer is ready (e.g. the bot asked the user to sign in). */
  initialMode?: ComputerViewMode;
  /** Called after the user hands control back. */
  onHandedBack?: () => void;
  className?: string;
  /** Height of the screen area; the desktop is 4:3 and scales to fit. */
  frameClassName?: string;
}

/**
 * Live view of a bot's cloud computer (§9.2): watch (view-only noVNC), take control and hand it back, full screen.
 * Opening it resumes a paused computer. The URL is signed and short-lived; it is refreshed before it expires.
 */
export const ComputerViewer: FC<Props> = ({ botId, initialMode = ComputerViewModes.WATCH, onHandedBack, className, frameClassName }) => {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const { data: computer } = useComputer(botId);
  const [live, setLive] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(initialMode);

  const open = useCallback(
    async (control: boolean) => {
      setBusy(control ? BusyActions.TAKE : BusyActions.OPEN);
      setError(null);
      try {
        const v = control ? await takeControl(botId) : await getLiveView(botId);
        setLive(v);
        qc.invalidateQueries({ queryKey: [QueryKeys.COMPUTER, botId] });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [botId, qc],
  );

  useEffect(() => {
    void open(modeRef.current === ComputerViewModes.CONTROL);
  }, [open]);

  // Refresh the signed URL a minute before it expires, keeping the current mode.
  useEffect(() => {
    if (!live) return;
    const ms = new Date(live.expires_at).getTime() - Date.now() - 60_000;
    const t = setTimeout(() => void open(live.control), Math.max(ms, 30_000));
    return () => clearTimeout(t);
  }, [live, open]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await wrapRef.current?.requestFullscreen().catch(() => setFullscreen((f) => !f));
  };

  const giveBack = async () => {
    setBusy(BusyActions.BACK);
    try {
      await handBack(botId);
      modeRef.current = ComputerViewModes.WATCH;
      await open(false);
      onHandedBack?.();
    } catch (e) {
      toast({ title: "Could not hand control back", description: (e as Error).message, variant: "error" });
      setBusy(null);
    }
  };

  const someoneElse = computer?.controlled_by && computer.controlled_by.user_id !== meId ? computer.controlled_by : null;
  const status = computer?.status ?? ComputerStatuses.OFF;
  const shownStatus = busy === BusyActions.OPEN && !live ? ComputerStatuses.STARTING : status;
  const st = { label: getDropdownOptionLabel(ComputerStatusOptions, shownStatus), tone: COMPUTER_STATUS_TONE[shownStatus] };

  return (
    <div ref={wrapRef} className={cn("flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker", fullscreen && "fixed inset-0 z-50 rounded-none border-0", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <MonitorPlay className="h-4 w-4 text-muted-foreground" aria-hidden />
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
          {live?.control ? "You have control — the bot waits until you hand it back." : someoneElse ? `${someoneElse.name ?? "Someone"} has control` : live ? "Watching" : ""}
        </span>
        {live && !live.control && (
          <Button size="sm" variant="outline" loading={busy === BusyActions.TAKE} disabled={!!someoneElse} onClick={() => void open(true)}>
            <MousePointerClick /> Take control
          </Button>
        )}
        {live?.control && (
          <Button size="sm" loading={busy === BusyActions.BACK} onClick={giveBack}>
            <Hand /> Hand back
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen} disabled={!live}>
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
      <div className={cn("relative w-full bg-[#1C1633]", fullscreen ? "flex-1" : cn("aspect-[4/3] max-h-[70vh]", frameClassName))}>
        {live ? (
          <iframe key={live.url} src={live.url} title="Cloud computer screen" className="absolute inset-0 h-full w-full border-0" allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-sm text-sm text-white/85">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void open(modeRef.current === ComputerViewModes.CONTROL)}>
              <RefreshCw /> Try again
            </Button>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <Skeleton className="h-2/3 w-3/4 rounded-md bg-white/10" />
            <p className="text-sm font-semibold text-white/85">Starting the computer… this can take a few seconds.</p>
          </div>
        )}
      </div>
    </div>
  );
};
