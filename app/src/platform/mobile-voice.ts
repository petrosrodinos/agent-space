import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * `@agentspace/voice` (§14.2, §7.6): voice mode run natively on Android, so it keeps working with the screen locked.
 * Kotlin side: app/android/app/src/main/java/com/agentspace/app/voice/ (VoicePlugin, VoiceEngine, VoiceService).
 *
 * The plugin owns the microphone, the WebRTC connection to OpenAI Realtime, the speaker and a foreground service
 * (microphone + media playback) with an ongoing "Voice mode is on" notification. The SDP exchange still goes through
 * our API, exactly like the browser: the plugin makes the offer, JS posts it to `POST /voice/sessions`
 * (startVoiceSession) and hands the answer back.
 *
 * How to switch app/src/features/voice/hooks/use-voice-session.ts over (owned by the voice/web team):
 *   1. In `start`, when `nativeVoice.available()`:
 *        const { sdp } = await nativeVoice.start({ title: `Voice mode with ${botName}`, url: Routes.chat.conversation(conversationId), micEnabled: opts.inputMode !== VoiceInputModes.PUSH_TO_TALK });
 *        const started = await startVoiceSession({ conversation_id, bot_id, sdp, input_mode });
 *        await nativeVoice.setAnswer(started.sdp);
 *      instead of getMicrophone() + RTCPeerConnection + createOffer/setRemoteDescription.
 *   2. Replace `channel.onmessage` with `nativeVoice.on(NativeVoiceEvents.MESSAGE, ({ data }) => …same parsing…)`,
 *      `conn.onconnectionstatechange` with `nativeVoice.on(NativeVoiceEvents.CONNECTION, ({ state }) => …)` (same
 *      state names as RTCPeerConnectionState), and the level meter with `NativeVoiceEvents.LEVEL` (0..1, mic only).
 *   3. `send(event)` → `nativeVoice.send(event)`; mute / push-to-talk → `nativeVoice.setMicEnabled(on)`.
 *   4. `stop()` / cleanup → `nativeVoice.stop()`; also listen for `NativeVoiceEvents.ENDED` (the user tapped End in the
 *      notification) and end the API session (endVoiceSession) when its reason is `NativeVoiceEndReasons.NOTIFICATION`.
 *   5. Camera pictures (§7.6) keep using `platform.media.getCamera()` in the WebView and go out with
 *      `nativeVoice.send({ type: "conversation.item.create", … })`; they stop when the app goes to the background.
 */
export const VOICE_PLUGIN = "AgentSpaceVoice";

export const NativeVoiceEvents = {
  /** `{ state }`: new | connecting | connected | disconnected | failed | closed. */
  CONNECTION: "connection",
  /** `{ data }`: one raw OpenAI Realtime data-channel event (JSON string). */
  MESSAGE: "message",
  /** `{ who }`: who is talking now, derived from the Realtime events. */
  SPEAKING: "speaking",
  /** `{ level }`: microphone level 0..1, about 10 times a second. */
  LEVEL: "level",
  /** `{ reason }`: voice mode ended natively. */
  ENDED: "ended",
} as const;
export type NativeVoiceEvent = (typeof NativeVoiceEvents)[keyof typeof NativeVoiceEvents];

export const NativeVoiceSpeakers = { USER: "user", BOT: "bot", NONE: "none" } as const;
export type NativeVoiceSpeaker = (typeof NativeVoiceSpeakers)[keyof typeof NativeVoiceSpeakers];

export const NativeVoiceEndReasons = { NOTIFICATION: "notification", APP: "app" } as const;
export type NativeVoiceEndReason = (typeof NativeVoiceEndReasons)[keyof typeof NativeVoiceEndReasons];

/** Rejection code when the user refuses the microphone. */
export const NATIVE_VOICE_MIC_DENIED = "MIC_DENIED";

export interface NativeVoiceEventPayloads {
  [NativeVoiceEvents.CONNECTION]: { state: RTCPeerConnectionState };
  [NativeVoiceEvents.MESSAGE]: { data: string };
  [NativeVoiceEvents.SPEAKING]: { who: NativeVoiceSpeaker };
  [NativeVoiceEvents.LEVEL]: { level: number };
  [NativeVoiceEvents.ENDED]: { reason: NativeVoiceEndReason };
}

interface VoicePlugin {
  start(options: { title?: string; url?: string; micEnabled?: boolean }): Promise<{ sdp: string }>;
  setAnswer(options: { sdp: string }): Promise<void>;
  send(options: { data: string }): Promise<{ sent: boolean }>;
  setMicEnabled(options: { enabled: boolean }): Promise<void>;
  stop(): Promise<void>;
  addListener<E extends NativeVoiceEvent>(event: E, cb: (payload: NativeVoiceEventPayloads[E]) => void): Promise<PluginListenerHandle>;
}

const Voice = registerPlugin<VoicePlugin>(VOICE_PLUGIN);

/** The `platform.voice`-style helpers for the mobile app (exported from native.ts as `nativeVoice`). */
export const nativeVoice = {
  /** True inside an Android build that has the native voice plugin. */
  available: () => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable(VOICE_PLUGIN),
  /** Asks for the microphone if needed, starts the foreground service and returns the WebRTC offer SDP. */
  start: (options: { title?: string; url?: string; micEnabled?: boolean } = {}) => Voice.start(options),
  setAnswer: (sdp: string) => Voice.setAnswer({ sdp }),
  /** Sends one Realtime event on the data channel; false when the channel isn't open. */
  send: async (event: Record<string, unknown>) => (await Voice.send({ data: JSON.stringify(event) })).sent,
  setMicEnabled: (enabled: boolean) => Voice.setMicEnabled({ enabled }),
  stop: () => Voice.stop(),
  /** Subscribes to a plugin event; returns an unsubscribe function. */
  on<E extends NativeVoiceEvent>(event: E, cb: (payload: NativeVoiceEventPayloads[E]) => void): () => void {
    const handle = Voice.addListener(event, cb);
    return () => void handle.then((h) => h.remove());
  },
};
