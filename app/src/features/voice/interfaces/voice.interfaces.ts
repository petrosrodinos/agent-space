/** What the voice bar shows (§7.6). */
export const VoicePhases = {
  IDLE: "idle",
  CONNECTING: "connecting",
  LISTENING: "listening",
  USER_SPEAKING: "user_speaking",
  THINKING: "thinking",
  /** Tool calls are running (searching, writing files, sending…). */
  WORKING: "working",
  BOT_SPEAKING: "bot_speaking",
  RECONNECTING: "reconnecting",
} as const;
export type VoicePhase = (typeof VoicePhases)[keyof typeof VoicePhases];

/** OpenAI Realtime client events sent/received on the WebRTC data channel. */
export const RealtimeAudioEvents = {
  SPEECH_STARTED: "input_audio_buffer.speech_started",
  SPEECH_STOPPED: "input_audio_buffer.speech_stopped",
  INPUT_COMMITTED: "input_audio_buffer.committed",
  INPUT_COMMIT: "input_audio_buffer.commit",
  INPUT_CLEAR: "input_audio_buffer.clear",
  OUTPUT_STARTED: "output_audio_buffer.started",
  OUTPUT_STOPPED: "output_audio_buffer.stopped",
  OUTPUT_CLEARED: "output_audio_buffer.cleared",
  OUTPUT_CLEAR: "output_audio_buffer.clear",
  RESPONSE_CANCEL: "response.cancel",
  RESPONSE_CREATE: "response.create",
  FUNCTION_CALL_DONE: "response.function_call_arguments.done",
  ITEM_ADDED: "conversation.item.added",
  ITEM_DONE: "conversation.item.done",
} as const;

/** Realtime conversation item types the voice bar watches. */
export const RealtimeItemTypes = { FUNCTION_CALL_OUTPUT: "function_call_output" } as const;

/** Data channel label expected by OpenAI Realtime. */
export const REALTIME_DATA_CHANNEL = "oai-events";

/** Why the server ended a voice session (VoiceSessionEndReason). */
export const VoiceEndReasons = {
  USER_EXIT: "USER_EXIT",
  SILENCE: "SILENCE",
  MAX_LENGTH: "MAX_LENGTH",
  CONNECTION_LOST: "CONNECTION_LOST",
  USAGE_LIMIT: "USAGE_LIMIT",
  ERROR: "ERROR",
} as const;
export type VoiceEndReason = (typeof VoiceEndReasons)[keyof typeof VoiceEndReasons];

/** RTCSessionDescription type of the answer returned by our API. */
export const SDP_ANSWER = "answer" as const;
