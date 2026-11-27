import { useEffect, type FC, type RefObject } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDictation } from "@/features/dictation/hooks/use-dictation";
import { insertDictatedText } from "@/features/dictation/utils/insert-text";
import { DictationStates } from "@/features/dictation/interfaces/dictation.interfaces";
import { Keys } from "@/config/constants/browser.constants";
import { cn } from "@/lib/utils";

interface Props {
  /** The field the text goes into (at the caret). */
  target: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  disabled?: boolean;
  className?: string;
  /** Icon size class for the button's svg, e.g. "!h-5 !w-5" in the chat composer. */
  iconClassName?: string;
}

/**
 * Mic button for dictating into a text field. Click to start, click again to stop; the text is inserted at the caret
 * and stays editable. Escape cancels. Has nothing to do with voice mode.
 */
export const DictationButton: FC<Props> = ({ target, disabled, className, iconClassName = "!h-4 !w-4" }) => {
  const d = useDictation((text) => {
    if (target.current) insertDictatedText(target.current, text);
  });
  const listening = d.state === DictationStates.LISTENING;
  const busy = d.state === DictationStates.REQUESTING || d.state === DictationStates.TRANSCRIBING;

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === Keys.ESCAPE) d.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, d]);

  const label = !d.supported
    ? "Dictation isn't available in this browser"
    : d.denied
      ? "Microphone blocked — allow it in your settings, then click to try again"
      : listening
        ? "Stop dictation (Esc to cancel)"
        : d.state === DictationStates.TRANSCRIBING
          ? "Transcribing…"
          : d.state === DictationStates.REQUESTING
            ? "Waiting for microphone…"
            : "Dictate";

  const Icon = d.state === DictationStates.TRANSCRIBING || d.state === DictationStates.REQUESTING ? Loader2 : listening ? Square : !d.supported || d.denied ? MicOff : Mic;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrapper keeps the tooltip working while the button is disabled. */}
          <span className={cn("inline-flex shrink-0", className)}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-full w-full", listening && "bg-error-soft text-error hover:bg-error-soft hover:text-error")}
              aria-label={label}
              aria-pressed={listening}
              disabled={disabled || !d.supported || busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={d.toggle}
            >
              <Icon className={cn(iconClassName, busy && "animate-spin", listening && "fill-current")} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <span className="sr-only" aria-live="polite">
        {listening ? "Listening" : d.state === DictationStates.TRANSCRIBING ? "Transcribing" : ""}
      </span>
    </>
  );
};
