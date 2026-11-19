import { VoiceEndReasons, VoicePhases } from "@/features/voice/interfaces/voice.interfaces";

/** Toast text when the server ends voice mode (§7.6). USER_EXIT shows nothing. */
export const VoiceEndReasonOptions = [
  { id: VoiceEndReasons.SILENCE, label: "Voice mode ended after 2 minutes of silence." },
  { id: VoiceEndReasons.MAX_LENGTH, label: "Voice mode reached the organisation's maximum session length." },
  { id: VoiceEndReasons.USAGE_LIMIT, label: "Voice mode ended because a usage limit was reached." },
  { id: VoiceEndReasons.CONNECTION_LOST, label: "Voice mode ended because the connection was lost." },
  { id: VoiceEndReasons.ERROR, label: "Voice mode ended because of an error." },
] as const;

/** Voice bar status line per phase. */
export const VoicePhaseOptions = [
  { id: VoicePhases.CONNECTING, label: "Connecting…" },
  { id: VoicePhases.LISTENING, label: "Listening" },
  { id: VoicePhases.USER_SPEAKING, label: "Listening…" },
  { id: VoicePhases.THINKING, label: "Thinking…" },
  { id: VoicePhases.WORKING, label: "Working…" },
  { id: VoicePhases.BOT_SPEAKING, label: "Speaking" },
  { id: VoicePhases.RECONNECTING, label: "Reconnecting…" },
  { id: VoicePhases.IDLE, label: "" },
] as const;
