import { useEffect, useRef, useState, type FC } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVoices } from "@/features/voice/hooks/use-voice-session";
import { getVoiceSample } from "@/features/voice/services/voice.services";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEFAULT = "__default__";
const SampleStates = { LOADING: "loading", PLAYING: "playing" } as const;
type SampleState = (typeof SampleStates)[keyof typeof SampleStates];

/** Voice picker with "Hear sample" (§7.6 Voices). `value = null` means the default (bot's or platform's) voice. */
export const VoicePicker: FC<{ value: string | null; onChange: (v: string | null) => void; disabled?: boolean; defaultLabel?: string; ariaLabel?: string; triggerClassName?: string }> = ({ value, onChange, disabled, defaultLabel = "Default voice", ariaLabel = "Voice", triggerClassName }) => {
  const { data } = useVoices();
  const [playing, setPlaying] = useState<SampleState | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const sample = async () => {
    if (playing === SampleStates.PLAYING) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    const voice = value ?? data?.default;
    if (!voice) return;
    setPlaying(SampleStates.LOADING);
    try {
      const blob = await getVoiceSample(voice);
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      const a = new Audio(url.current);
      audio.current = a;
      a.onended = () => setPlaying(null);
      await a.play();
      setPlaying(SampleStates.PLAYING);
    } catch (e) {
      setPlaying(null);
      toast({ title: "Could not play the sample", description: (e as Error).message, variant: "error" });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? null : v)} disabled={disabled}>
        <SelectTrigger className={cn("w-[200px]", triggerClassName)} aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
          {data?.voices.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.label} · <span className="text-muted-foreground">{v.description}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => void sample()} aria-label={playing === SampleStates.PLAYING ? "Stop sample" : "Hear sample"} title="Hear sample">
        {playing === SampleStates.LOADING ? <Loader2 className="animate-spin" /> : playing === SampleStates.PLAYING ? <Square className="!h-3.5 !w-3.5 fill-current" /> : <Play />}
      </Button>
    </div>
  );
};
