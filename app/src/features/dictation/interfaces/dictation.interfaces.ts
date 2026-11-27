/** Dictation (speech → text in a text field). Separate from voice mode: no session, nothing is sent to a bot. */
export const DictationStates = {
  IDLE: "idle",
  /** Waiting for the browser/OS microphone permission prompt. */
  REQUESTING: "requesting",
  LISTENING: "listening",
  TRANSCRIBING: "transcribing",
} as const;
export type DictationState = (typeof DictationStates)[keyof typeof DictationStates];

/** Longest single dictation; recording stops on its own after this and the text is inserted. */
export const MAX_DICTATION_MS = 3 * 60_000;

/** Recorder formats in preference order; the first the browser supports is used. */
export const DICTATION_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"] as const;

export const MediaErrorNames = {
  NOT_ALLOWED: "NotAllowedError",
  SECURITY: "SecurityError",
  NOT_FOUND: "NotFoundError",
  NOT_READABLE: "NotReadableError",
} as const;
