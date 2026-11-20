import { useCallback, useEffect, useRef, useState } from "react";
import { platform } from "@/platform";
import { getDesktopBridge } from "@/platform/desktop-bridge";
import type { ScreenSource } from "@/platform/device-bridge";
import { toast } from "@/hooks/use-toast";
import { sendVoiceSnapshot, setVoiceVisual } from "../services/voice.services";
import { VisualKinds, type VisualKind } from "../interfaces/voice.interfaces";
import type { VoiceSession } from "./use-voice-session";

/** Pictures sent to the bot: at most 1024 px on the longest side, JPEG quality 0.7 (§7.6). */
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.7;
const DESKTOP_PREVIEW_MS = 3000;

export const CameraFacings = { USER: "user", ENVIRONMENT: "environment" } as const;
export type CameraFacing = (typeof CameraFacings)[keyof typeof CameraFacings];

const toJpeg = (source: CanvasImageSource, w: number, h: number) => {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the picture"));
    img.src = src;
  });

/**
 * Camera and screen sharing in voice mode (§7.6). The user turns them on; the bot gets a still picture when the user
 * starts speaking or taps "Show this". In the desktop app the screen comes from the device bridge picker; in browsers
 * from getDisplayMedia; phones have the camera only.
 */
export function useVoiceVisual(voice: VoiceSession) {
  const [kind, setKind] = useState<VisualKind | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>(CameraFacings.USER);
  const [sources, setSources] = useState<ScreenSource[] | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;
  // Leaving the voice bar always turns the camera or screen sharing off.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );
  const desktopSource = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const device = getDesktopBridge()?.device ?? null;
  const canScreen = platform.media.canShareScreen();

  const grab = useCallback(async (): Promise<string | null> => {
    if (desktopSource.current && device) {
      const shot = await device.captureSource(desktopSource.current);
      setPreview(shot.dataUrl);
      const img = await loadImage(shot.dataUrl);
      return toJpeg(img, img.naturalWidth, img.naturalHeight);
    }
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    return toJpeg(v, v.videoWidth, v.videoHeight);
  }, [device]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    desktopSource.current = null;
    video.current = null;
    setStream(null);
    setPreview(null);
    setKind(null);
    setSources(null);
    voice.setPictureSource(null);
    if (voice.sessionId) void setVoiceVisual(voice.sessionId, null).catch(() => undefined);
  }, [stream, voice]);

  const activate = useCallback(
    (k: VisualKind, s: MediaStream | null) => {
      if (s) {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.srcObject = s;
        void v.play().catch(() => undefined);
        video.current = v;
        // Sharing ends when the browser's "Stop sharing" button is used.
        s.getVideoTracks()[0]?.addEventListener("ended", () => stop());
      }
      setStream(s);
      setKind(k);
      voice.setPictureSource(grab);
      if (voice.sessionId) void setVoiceVisual(voice.sessionId, k).catch(() => undefined);
    },
    [grab, stop, voice],
  );

  const startCamera = useCallback(
    async (f: CameraFacing = facing) => {
      stream?.getTracks().forEach((t) => t.stop());
      try {
        const s = await platform.media.getCamera(f);
        setFacing(f);
        activate(VisualKinds.CAMERA, s);
      } catch {
        toast({ title: "Camera access is needed", description: "Allow the camera for Agent Space, then try again.", variant: "error" });
      }
    },
    [activate, facing, stream],
  );

  const startScreen = useCallback(async () => {
    stream?.getTracks().forEach((t) => t.stop());
    if (device) {
      setSources(await device.screenSources().catch(() => []));
      return;
    }
    const req = platform.media.getScreen();
    if (!req) return;
    try {
      activate(VisualKinds.SCREEN, await req);
    } catch {
      // The user cancelled the browser's picker.
    }
  }, [activate, device, stream]);

  /** Desktop app: the user picked a window or screen in our picker. */
  const pickDesktopSource = useCallback(
    (id: string | null) => {
      setSources(null);
      if (!id || !device) return;
      desktopSource.current = id;
      activate(VisualKinds.SCREEN, null);
      void grab();
      timer.current = window.setInterval(() => void grab().catch(() => undefined), DESKTOP_PREVIEW_MS);
    },
    [activate, device, grab],
  );

  const snapshot = useCallback(async () => {
    if (!voice.sessionId) return;
    const url = await grab().catch(() => null);
    if (!url) return;
    try {
      await sendVoiceSnapshot(voice.sessionId, url);
      toast({ title: "Snapshot posted in the chat", duration: 2000 });
    } catch (e) {
      toast({ title: "Could not post the snapshot", description: (e as Error).message, variant: "error" });
    }
  }, [grab, voice.sessionId]);

  // Sharing always stops when voice mode turns off.
  useEffect(() => {
    if (!voice.active && kind) stop();
  }, [voice.active, kind, stop]);

  // On phones the camera stops when the app goes to the background; the voice conversation carries on.
  useEffect(() => {
    if (kind !== VisualKinds.CAMERA || !platform.is("android")) return;
    const onHide = () => {
      if (!platform.lifecycle.isVisible()) stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [kind, stop]);

  return {
    allowed: voice.visualAllowed,
    kind,
    stream,
    /** Desktop screen sharing: a still refreshed every few seconds. */
    preview,
    facing,
    canScreen,
    /** Desktop app: sources to pick from (picker open while not null). */
    sources,
    toggleCamera: () => (kind === VisualKinds.CAMERA ? stop() : void startCamera()),
    toggleScreen: () => (kind === VisualKinds.SCREEN ? stop() : void startScreen()),
    flipCamera: () => void startCamera(facing === CameraFacings.USER ? CameraFacings.ENVIRONMENT : CameraFacings.USER),
    pickDesktopSource,
    showThis: () => void voice.showThis(),
    snapshot: () => void snapshot(),
    stop,
  };
}

export type VoiceVisual = ReturnType<typeof useVoiceVisual>;
