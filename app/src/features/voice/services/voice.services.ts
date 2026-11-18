import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import { type VoiceInputMode } from "@/features/users/interfaces/users.interfaces";

export interface VoiceOption {
  id: string;
  label: string;
  description: string;
}

export interface StartedVoiceSession {
  id: string;
  sdp: string;
  bot_id: string;
  voice: string;
  input_mode: VoiceInputMode;
  max_minutes: number;
}

export const getVoices = () => request<{ voices: VoiceOption[]; default: string }>(() => axiosInstance.get(ApiRoutes.voice.voices));
export const getVoiceSample = (voice: string) => request<Blob>(() => axiosInstance.get(ApiRoutes.voice.sample(voice), { responseType: "blob" }));
export const startVoiceSession = (dto: { conversation_id: string; bot_id?: string; sdp: string; input_mode?: VoiceInputMode }) =>
  request<StartedVoiceSession>(() => axiosInstance.post(ApiRoutes.voice.sessions, dto), "Could not start voice mode.");
export const sendVoiceText = (id: string, text: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.voice.text(id), { text }));
export const endVoiceSession = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.voice.one(id)));
