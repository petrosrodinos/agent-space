import { useCallback, useEffect, useRef, useState } from "react";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { transcribeDictation } from "../services/dictation.services";
import { DICTATION_MIME_TYPES, DictationStates, MAX_DICTATION_MS, MediaErrorNames, type DictationState } from "../interfaces/dictation.interfaces";

/** Whether this browser/app can record audio at all. */
export const dictationSupported = () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

const pickMimeType = () => DICTATION_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));

const micErrorMessage = (e: unknown) => {
  const name = (e as { name?: string })?.name;
  if (name === MediaErrorNames.NOT_ALLOWED || name === MediaErrorNames.SECURITY) return { title: "Microphone blocked", description: "Allow microphone access for this app in your browser or system settings, then try again." };
  if (name === MediaErrorNames.NOT_FOUND) return { title: "No microphone found", description: "Connect a microphone and try again." };
  if (name === MediaErrorNames.NOT_READABLE) return { title: "Microphone busy", description: "Another app is using the microphone. Close it and try again." };
  return { title: "Couldn't start dictation", description: "The microphone isn't available right now." };
};

/**
 * Dictation: records from the microphone until stopped, then turns the speech into text and hands it to `onText`.
 * Independent of voice mode — it never opens a voice session or sends anything to a bot. Audio stays in memory only
 * for the upload and is released right after.
 */
export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>(DictationStates.IDLE);
  const [denied, setDenied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  /** Stops without transcribing (Escape, unmount). */
  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else release();
    setState(DictationStates.IDLE);
  }, [release]);

  const start = useCallback(async () => {
    if (!dictationSupported()) {
      toast({ title: "Dictation isn't available", description: "This browser can't record audio. Type your text instead.", variant: "error" });
      return;
    }
    cancelled.current = false;
    setState(DictationStates.REQUESTING);
    let media: MediaStream;
    try {
      media = await platform.media.getMicrophone();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === MediaErrorNames.NOT_ALLOWED || name === MediaErrorNames.SECURITY) setDenied(true);
      toast({ ...micErrorMessage(e), variant: "error" });
      setState(DictationStates.IDLE);
      return;
    }
    if (cancelled.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    setDenied(false);
    stream.current = media;
    chunks.current = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
    recorder.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = async () => {
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks.current, { type: type.split(";")[0] });
      chunks.current = [];
      release();
      if (cancelled.current || !blob.size) {
        setState(DictationStates.IDLE);
        return;
      }
      setState(DictationStates.TRANSCRIBING);
      try {
        const { text } = await transcribeDictation(blob);
        if (text) onTextRef.current(text);
        else toast({ title: "Didn't catch that", description: "No speech was picked up. Try again a little closer to the microphone.", variant: "error" });
      } catch (e) {
        toast({ title: "Dictation failed", description: (e as Error).message, variant: "error" });
      } finally {
        setState(DictationStates.IDLE);
      }
    };
    rec.start(1000);
    setState(DictationStates.LISTENING);
    timer.current = setTimeout(stop, MAX_DICTATION_MS);
  }, [release, stop]);

  const toggle = useCallback(() => {
    if (state === DictationStates.LISTENING) stop();
    else if (state === DictationStates.IDLE) void start();
  }, [state, start, stop]);

  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [release],
  );

  return { state, denied, supported: dictationSupported(), start, stop, cancel, toggle };
}
