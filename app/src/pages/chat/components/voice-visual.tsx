import { useCallback, type FC } from "react";
import { Camera, Eye, MonitorUp, SwitchCamera, Video, VideoOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VoiceVisual } from "@/features/voice/hooks/use-voice-visual";
import { VisualKinds } from "@/features/voice/interfaces/voice.interfaces";
import { platform } from "@/platform";
import { cn } from "@/lib/utils";

/** Camera / Share screen toggles in the voice bar (§7.6). Only the user turns them on. */
export const VoiceVisualButtons: FC<{ visual: VoiceVisual; disabled?: boolean }> = ({ visual, disabled }) => {
  if (!visual.allowed) return null;
  const camOn = visual.kind === VisualKinds.CAMERA;
  const screenOn = visual.kind === VisualKinds.SCREEN;
  return (
    <>
      <Button type="button" variant={camOn ? "default" : "outline"} size="icon" className="h-10 w-10" onClick={visual.toggleCamera} disabled={disabled} aria-label={camOn ? "Turn camera off" : "Camera"} aria-pressed={camOn}>
        {camOn ? <VideoOff /> : <Video />}
      </Button>
      {visual.canScreen && (
        <Button type="button" variant={screenOn ? "default" : "outline"} size="icon" className="h-10 w-10" onClick={visual.toggleScreen} disabled={disabled} aria-label={screenOn ? "Stop sharing screen" : "Share screen"} aria-pressed={screenOn}>
          <MonitorUp />
        </Button>
      )}
    </>
  );
};

/** Small live preview with a red "Live" dot, plus Show this and Snapshot (§7.6). */
export const VoiceVisualPreview: FC<{ visual: VoiceVisual }> = ({ visual }) => {
  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && visual.stream && el.srcObject !== visual.stream) {
        el.srcObject = visual.stream;
        void el.play().catch(() => undefined);
      }
    },
    [visual.stream],
  );
  if (!visual.kind) return null;
  const label = visual.kind === VisualKinds.CAMERA ? "Camera" : "Screen";
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-sunken p-1.5" aria-label={`${label} sharing`}>
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-black">
        {visual.stream ? (
          <video ref={attach} muted playsInline className={cn("h-full w-full object-cover", visual.kind === VisualKinds.CAMERA && visual.facing === "user" && "-scale-x-100")} />
        ) : visual.preview ? (
          <img src={visual.preview} alt="" className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" /> Live
        </span>
      </div>
      <p className="hidden min-w-0 flex-1 text-xs text-muted-foreground sm:block">{label} on — the bot sees a picture when you speak.</p>
      <span className="flex-1 sm:hidden" />
      {visual.kind === VisualKinds.CAMERA && platform.is("android") && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={visual.flipCamera} aria-label="Switch camera">
          <SwitchCamera />
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={visual.showThis}>
        <Eye /> <span className="hidden sm:inline">Show this</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={visual.snapshot} aria-label="Snapshot: post this picture in the chat" title="Snapshot">
        <Camera />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={visual.stop} aria-label={`Turn ${label.toLowerCase()} off`} title={`Turn ${label.toLowerCase()} off`}>
        <X />
      </Button>
    </div>
  );
};

/** Desktop app: pick a window or screen to share (the browser's own picker is used on the web). */
export const DesktopScreenPicker: FC<{ visual: VoiceVisual }> = ({ visual }) => (
  <Dialog open={!!visual.sources} onOpenChange={(o) => !o && visual.pickDesktopSource(null)}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Share a window or screen</DialogTitle>
        <DialogDescription>The bot sees a picture of it when you speak. You can stop at any time.</DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {(visual.sources ?? []).map((s) => (
          <button key={s.id} type="button" onClick={() => visual.pickDesktopSource(s.id)} className="rounded-md border border-hairline p-1.5 text-left text-xs hover:border-primary">
            <img src={s.thumbnail} alt="" className="mb-1 aspect-video w-full rounded object-cover" />
            <span className="line-clamp-1 font-semibold text-ink">{s.name}</span>
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => visual.pickDesktopSource(null)}>Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
