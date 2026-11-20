import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platform } from "@/platform";
import { realtime } from "@/features/realtime/services/realtime.services";
import { toast } from "@/hooks/use-toast";
import { endVoiceSession, getVoiceModels, getVoices, sendVoiceText, startVoiceSession } from "../services/voice.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { VoicePhases, RealtimeAudioEvents, RealtimeItemTypes, RealtimeContentTypes, REALTIME_DATA_CHANNEL, REALTIME_ITEM_CREATE, type VoicePhase, SDP_ANSWER } from "../interfaces/voice.interfaces";
import { RtcConnectionStates, DataChannelStates } from "@/config/constants/browser.constants";
import { VoiceInputModes, type VoiceInputMode } from "@/features/users/interfaces/users.interfaces";
import { UserEventTypes } from "@/features/realtime/interfaces/realtime.interfaces";
import { VoiceEndReasonOptions } from "@/config/constants/dropdowns/voice/voice.options";



export const useVoices = () => useQuery({ queryKey: [QueryKeys.VOICES], queryFn: getVoices, staleTime: Infinity });
export const useVoiceModels = () => useQuery({ queryKey: [QueryKeys.VOICE_MODELS], queryFn: getVoiceModels, staleTime: Infinity });

/**
 * Voice mode client (§7.6): microphone → WebRTC → OpenAI Realtime. The SDP offer goes to our API, which answers
 * with the real key server-side. A data channel carries interrupt / push-to-talk controls; everything the bot does
 * (tools, approvals, transcripts) arrives as normal chat messages.
 */
export function useVoiceSession(conversationId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<VoicePhase>(VoicePhases.IDLE);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<VoiceInputMode>(VoiceInputModes.HANDS_FREE);
  const [botId, setBotId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const sessionRef = useRef<string | null>(null);
  const dropTimer = useRef<number | null>(null);
  /** Tool calls the server is still running (call ids), so the bar shows "Working…" instead of "Listening". */
  const toolCalls = useRef<Set<string>>(new Set());
  const [visualAllowed, setVisualAllowed] = useState(false);
  /** §7.6: while the camera or screen sharing is on, gives a still picture (JPEG data URL) to send to the bot. */
  const pictureSource = useRef<(() => Promise<string | null>) | null>(null);

  /** Grabs a still from the camera or shared screen and adds it to the conversation (never stored by us). */
  const sendPicture = useCallback(async (respond = false) => {
    const grab = pictureSource.current;
    const channel = dc.current;
    if (!grab || channel?.readyState !== DataChannelStates.OPEN) return false;
    const url = await grab().catch(() => null);
    if (!url) return false;
    channel.send(JSON.stringify({ type: REALTIME_ITEM_CREATE, item: { type: RealtimeItemTypes.MESSAGE, role: "user", content: [{ type: RealtimeContentTypes.INPUT_IMAGE, image_url: url }] } }));
    if (respond) channel.send(JSON.stringify({ type: RealtimeAudioEvents.RESPONSE_CREATE }));
    return true;
  }, []);

  const cleanup = useCallback(() => {
    if (dropTimer.current) window.clearTimeout(dropTimer.current);
    dropTimer.current = null;
    if (meter.current) {
      cancelAnimationFrame(meter.current.raf);
      void meter.current.ctx.close().catch(() => undefined);
      meter.current = null;
    }
    dc.current?.close();
    pc.current?.close();
    mic.current?.getTracks().forEach((t) => t.stop());
    if (audio.current) {
      audio.current.srcObject = null;
      audio.current.remove();
    }
    pc.current = null;
    dc.current = null;
    mic.current = null;
    audio.current = null;
    sessionRef.current = null;
    toolCalls.current.clear();
    setSessionId(null);
    setPhase(VoicePhases.IDLE);
    setMuted(false);
    setLevel(0);
  }, []);

  const stop = useCallback(async () => {
    const id = sessionRef.current;
    cleanup();
    if (id) await endVoiceSession(id).catch(() => undefined);
  }, [cleanup]);

  // The server ends sessions on silence, max length, usage limits or "that's all".
  useEffect(
    () =>
      realtime.on((e) => {
        if (e.type === UserEventTypes.VOICE_ENDED && e.data?.voice_session_id === sessionRef.current) {
          const reason = VoiceEndReasonOptions.find((o) => o.id === e.data.reason)?.label;
          cleanup();
          if (reason) toast({ title: reason, duration: 4000 });
        }
      }),
    [cleanup],
  );

  useEffect(() => () => void stop(), [stop]);
  useEffect(() => {
    void stop();
  }, [conversationId, stop]);

  /** Animated waveform level from the mic (user) or the bot's audio. */
  const startMeter = (local: MediaStream, remote: MediaStream) => {
    const ctx = new AudioContext();
    const make = (s: MediaStream) => {
      const a = ctx.createAnalyser();
      a.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(a);
      return a;
    };
    const la = make(local);
    const ra = make(remote);
    const buf = new Uint8Array(128);
    const rms = (a: AnalyserNode) => {
      a.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      return Math.sqrt(sum / buf.length);
    };
    const loop = () => {
      setLevel(Math.min(1, Math.max(rms(la), rms(ra)) * 4));
      meter.current!.raf = requestAnimationFrame(loop);
    };
    meter.current = { ctx, raf: requestAnimationFrame(loop) };
  };

  const start = useCallback(
    async (opts: { botId?: string; inputMode?: VoiceInputMode } = {}) => {
      if (sessionRef.current) return;
      setPhase(VoicePhases.CONNECTING);
      let stream: MediaStream;
      try {
        stream = await platform.media.getMicrophone();
      } catch {
        setPhase(VoicePhases.IDLE);
        toast({
          title: "Microphone access is needed for voice mode",
          description: "Allow the microphone for this site in your browser settings (the camera/mic icon in the address bar), then try again. You can keep typing meanwhile.",
          variant: "error",
          duration: 8000,
        });
        return;
      }
      try {
        mic.current = stream;
        const conn = new RTCPeerConnection();
        pc.current = conn;
        const el = document.createElement("audio");
        el.autoplay = true;
        audio.current = el;
        conn.ontrack = (ev) => {
          el.srcObject = ev.streams[0];
          startMeter(stream, ev.streams[0]);
        };
        const track = stream.getAudioTracks()[0];
        if (opts.inputMode === VoiceInputModes.PUSH_TO_TALK) track.enabled = false;
        conn.addTrack(track, stream);
        const channel = conn.createDataChannel(REALTIME_DATA_CHANNEL);
        dc.current = channel;
        channel.onmessage = (m) => {
          try {
            const ev = JSON.parse(m.data as string) as { type: string; call_id?: string; item?: { type?: string; call_id?: string } };
            const idle = () => (toolCalls.current.size ? VoicePhases.WORKING : VoicePhases.LISTENING);
            if (ev.type === RealtimeAudioEvents.SPEECH_STARTED) {
              setPhase(VoicePhases.USER_SPEAKING);
              // One picture per spoken turn, sent as they start so it arrives with what they say (§7.6).
              void sendPicture();
            }
            else if (ev.type === RealtimeAudioEvents.SPEECH_STOPPED || ev.type === RealtimeAudioEvents.INPUT_COMMITTED) setPhase(VoicePhases.THINKING);
            else if (ev.type === RealtimeAudioEvents.OUTPUT_STARTED) setPhase(VoicePhases.BOT_SPEAKING);
            else if (ev.type === RealtimeAudioEvents.OUTPUT_STOPPED || ev.type === RealtimeAudioEvents.OUTPUT_CLEARED) setPhase(idle());
            else if (ev.type === RealtimeAudioEvents.FUNCTION_CALL_DONE && ev.call_id) {
              toolCalls.current.add(ev.call_id);
              setPhase((p) => (p === VoicePhases.BOT_SPEAKING ? p : VoicePhases.WORKING));
            } else if ((ev.type === RealtimeAudioEvents.ITEM_ADDED || ev.type === RealtimeAudioEvents.ITEM_DONE) && ev.item?.type === RealtimeItemTypes.FUNCTION_CALL_OUTPUT && ev.item.call_id) {
              // The server answered the tool call; the bot's spoken reply follows.
              toolCalls.current.delete(ev.item.call_id);
              setPhase((p) => (p === VoicePhases.WORKING && !toolCalls.current.size ? VoicePhases.THINKING : p));
            }
          } catch {
            /* ignore non-JSON */
          }
        };
        conn.onconnectionstatechange = () => {
          const s = conn.connectionState;
          if (s === RtcConnectionStates.CONNECTED) {
            if (dropTimer.current) window.clearTimeout(dropTimer.current);
            dropTimer.current = null;
            setPhase((p) => (p === VoicePhases.CONNECTING || p === VoicePhases.RECONNECTING ? VoicePhases.LISTENING : p));
          } else if (s === RtcConnectionStates.DISCONNECTED) {
            // Reconnect window: up to 15 seconds, then voice mode turns off (§7.6).
            setPhase(VoicePhases.RECONNECTING);
            dropTimer.current = window.setTimeout(() => {
              toast({ title: "Voice mode ended — the connection dropped. Everything said so far is in the chat.", duration: 5000 });
              void stop();
            }, 15_000);
          } else if (s === RtcConnectionStates.FAILED) {
            toast({ title: "Voice connection failed", description: "Everything said so far is in the chat.", variant: "error" });
            void stop();
          }
        };
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        const started = await startVoiceSession({ conversation_id: conversationId, bot_id: opts.botId, sdp: offer.sdp!, input_mode: opts.inputMode });
        sessionRef.current = started.id;
        setSessionId(started.id);
        setBotId(started.bot_id);
        setMode(started.input_mode);
        setVisualAllowed(!!started.visual_input_allowed);
        await conn.setRemoteDescription({ type: SDP_ANSWER, sdp: started.sdp });
      } catch (e) {
        cleanup();
        toast({ title: "Could not start voice mode", description: (e as Error).message, variant: "error" });
      }
    },
    [cleanup, conversationId, stop, sendPicture],
  );

  const send = (event: Record<string, unknown>) => {
    if (dc.current?.readyState === DataChannelStates.OPEN) dc.current.send(JSON.stringify(event));
  };



  return {
    active: !!sessionId || phase === VoicePhases.CONNECTING,
    sessionId,
    phase,
    muted,
    mode,
    botId,
    level,
    start,
    stop,
    toggleMute: () => {
      const t = mic.current?.getAudioTracks()[0];
      if (!t || mode === VoiceInputModes.PUSH_TO_TALK) return;
      t.enabled = muted;
      setMuted(!muted);
    },
    /** Stop bot: cancel the reply and silence it immediately (also cancels the tool step server-side when it ends the response). */
    interrupt: () => {
      send({ type: RealtimeAudioEvents.RESPONSE_CANCEL });
      send({ type: RealtimeAudioEvents.OUTPUT_CLEAR });
      setPhase(VoicePhases.LISTENING);
    },
    visualAllowed,
    /** Set while the camera or screen sharing is on (null when off). */
    setPictureSource: (fn: (() => Promise<string | null>) | null) => {
      pictureSource.current = fn;
    },
    /** "Show this": send the current picture now and let the bot answer. */
    showThis: () => sendPicture(true),
    pushStart: () => {
      const t = mic.current?.getAudioTracks()[0];
      if (!t) return;
      void sendPicture();
      send({ type: RealtimeAudioEvents.RESPONSE_CANCEL });
      send({ type: RealtimeAudioEvents.OUTPUT_CLEAR });
      send({ type: RealtimeAudioEvents.INPUT_CLEAR });
      t.enabled = true;
      setPhase(VoicePhases.USER_SPEAKING);
    },
    pushEnd: () => {
      const t = mic.current?.getAudioTracks()[0];
      if (!t) return;
      t.enabled = false;
      send({ type: RealtimeAudioEvents.INPUT_COMMIT });
      send({ type: RealtimeAudioEvents.RESPONSE_CREATE });
      setPhase(VoicePhases.THINKING);
    },
    sendText: async (text: string) => {
      if (!sessionRef.current) return;
      await sendVoiceText(sessionRef.current, text).catch((e) => toast({ title: "Could not send", description: (e as Error).message, variant: "error" }));
    },
  };
}

export type { VoicePhase };
export type VoiceSession = ReturnType<typeof useVoiceSession>;
