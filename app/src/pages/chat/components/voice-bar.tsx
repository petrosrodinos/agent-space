import { useState, type FC } from "react";
import { Keyboard, Loader2, LogOut, Maximize2, Mic, MicOff, Minimize2, MoreHorizontal, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { Input } from "@/components/ui/input";
import type { VoiceSession } from "@/features/voice/hooks/use-voice-session";
import { cn } from "@/lib/utils";
import { VoicePhases } from "@/features/voice/interfaces/voice.interfaces";
import { VoiceInputModes } from "@/features/users/interfaces/users.interfaces";
import { Keys } from "@/config/constants/browser.constants";
import { VoicePhaseOptions } from "@/config/constants/dropdowns/voice/voice.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useVoiceVisual } from "@/features/voice/hooks/use-voice-visual";
import { DesktopScreenPicker, VoiceVisualButtons, VoiceVisualPreview } from "./voice-visual";


/** Animated waveform: bar heights follow the live audio level (who is speaking). */
const Waveform: FC<{ level: number; color: string; big?: boolean }> = ({ level, color, big }) => (
  <div className={cn("flex items-center gap-[3px]", big ? "h-24" : "h-8")} aria-hidden>
    {Array.from({ length: big ? 28 : 18 }).map((_, i) => {
      const wave = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + level * 9));
      const h = Math.max(0.12, Math.min(1, level * 1.6 * wave + 0.08));
      return <span key={i} className="w-[4px] rounded-full transition-[height] duration-100" style={{ height: `${h * 100}%`, backgroundColor: color }} />;
    })}
  </div>
);

interface Props {
  voice: VoiceSession;
  bot: { name: string; emoji: string; color: string } | null;
}

/**
 * Voice bar (§7.6): replaces the message box while voice mode is on — bot avatar, waveform, Mute mic, Stop bot,
 * Keyboard (type without leaving voice mode) and Exit. On phones it can expand to a full-screen voice view.
 */
export const VoiceBar: FC<Props> = ({ voice, bot }) => {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [full, setFull] = useState(false);
  const visual = useVoiceVisual(voice);
  const color = bot?.color ?? "var(--primary)";
  const ptt = voice.mode === VoiceInputModes.PUSH_TO_TALK;
  const label = voice.muted ? "Mic muted" : getDropdownOptionLabel(VoicePhaseOptions, voice.phase, "");
  const spinning = voice.phase === VoicePhases.CONNECTING || voice.phase === VoicePhases.RECONNECTING || voice.phase === VoicePhases.WORKING;

  const controls = (
    <div className="flex items-center justify-center gap-1.5">
      {!ptt && (
        <Button type="button" variant={voice.muted ? "default" : "outline"} size="icon" className="h-10 w-10" onClick={voice.toggleMute} aria-label={voice.muted ? "Unmute mic" : "Mute mic"} aria-pressed={voice.muted}>
          {voice.muted ? <MicOff /> : <Mic />}
        </Button>
      )}
      <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={voice.interrupt} aria-label="Stop bot" disabled={voice.phase === VoicePhases.CONNECTING}>
        <Square className="!h-4 !w-4 fill-current" />
      </Button>
      <VoiceVisualButtons visual={visual} disabled={voice.phase === VoicePhases.CONNECTING} />
      <Button type="button" variant={typing ? "default" : "outline"} size="icon" className="hidden h-10 w-10 sm:inline-flex" onClick={() => setTyping((t) => !t)} aria-label="Keyboard" aria-pressed={typing}>
        <Keyboard />
      </Button>
      {/* Phones: Keyboard and Full screen live in a "More" menu to keep the row short. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 sm:hidden" aria-label="More voice options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTyping((t) => !t)}>
            <Keyboard /> {typing ? "Hide keyboard" : "Type a message"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFull((f) => !f)}>
            {full ? <Minimize2 /> : <Maximize2 />} {full ? "Leave full screen" : "Full screen"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" variant="destructive" size="sm" className="h-10" onClick={() => void voice.stop()} aria-label="Exit voice mode">
        <LogOut /> <span className="hidden sm:inline">Exit</span>
      </Button>
    </div>
  );

  const pttButton = ptt && (
    <button
      type="button"
      className={cn(
        "flex h-14 select-none items-center justify-center gap-2 rounded-full px-6 font-bold text-white shadow-pop transition-transform active:scale-95",
        voice.phase === VoicePhases.USER_SPEAKING ? "bg-error" : "bg-primary",
      )}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        voice.pushStart();
      }}
      onPointerUp={voice.pushEnd}
      onPointerCancel={voice.pushEnd}
      onKeyDown={(e) => {
        if ((e.key === Keys.SPACE || e.key === Keys.ENTER) && !e.repeat) voice.pushStart();
      }}
      onKeyUp={(e) => {
        if (e.key === Keys.SPACE || e.key === Keys.ENTER) voice.pushEnd();
      }}
      aria-label="Hold to talk"
    >
      <Mic className="h-5 w-5" /> {voice.phase === VoicePhases.USER_SPEAKING ? "Release to send" : "Hold to talk"}
    </button>
  );

  const typeBox = typing && (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        void voice.sendText(text.trim());
        setText("");
      }}
    >
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type to ${bot?.name ?? "the bot"} — voice stays on`} aria-label="Type a message" autoFocus />
      <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!text.trim()} aria-label="Send">
        <SendHorizontal />
      </Button>
    </form>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-canvas px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-16" role="dialog" aria-label="Voice mode">
        <div className="flex flex-col items-center gap-4 text-center">
          {bot && <BotAvatar emoji={bot.emoji} color={bot.color} size={88} name={bot.name} />}
          <p className="font-display text-2xl font-bold text-ink">{bot?.name}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground" aria-live="polite">{spinning && <Loader2 className="h-4 w-4 animate-spin" />} {label}</p>
        </div>
        <Waveform level={voice.level} color={color} big />
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <VoiceVisualPreview visual={visual} />
          {pttButton}
          {typeBox && <div className="w-full">{typeBox}</div>}
          {controls}
        </div>
        <DesktopScreenPicker visual={visual} />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border-[1.5px] border-primary bg-surface p-2.5 pl-3 shadow-pop" role="region" aria-label="Voice mode">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {bot && <BotAvatar emoji={bot.emoji} color={bot.color} size={40} />}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" aria-live="polite">
              {spinning && <Loader2 className="h-3 w-3 animate-spin" />} {label}
            </p>
            <Waveform level={voice.level} color={color} />
          </div>
        </div>
        {pttButton}
        {controls}
      </div>
      <VoiceVisualPreview visual={visual} />
      {typeBox}
      <DesktopScreenPicker visual={visual} />
    </div>
  );
};
