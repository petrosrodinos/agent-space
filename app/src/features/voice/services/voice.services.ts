import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import { type VoiceInputMode } from "@/features/users/interfaces/users.interfaces";
import type { VisualKind } from "../interfaces/voice.interfaces";

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
  /** §7.6 camera and screen sharing allowed by the organisation. */
  visual_input_allowed: boolean;
}

export interface VoiceModelOption {
  id: string;
  label: string;
  description: string;
}

export const getVoiceModels = () => request<{ models: VoiceModelOption[]; default: string }>(() => axiosInstance.get(ApiRoutes.voice.models));
export const getVoices = () => request<{ voices: VoiceOption[]; default: string }>(() => axiosInstance.get(ApiRoutes.voice.voices));
export const getVoiceSample = (voice: string) => request<Blob>(() => axiosInstance.get(ApiRoutes.voice.sample(voice), { responseType: "blob" }));
export const startVoiceSession = (dto: { conversation_id: string; bot_id?: string; sdp: string; input_mode?: VoiceInputMode }) =>
  request<StartedVoiceSession>(() => axiosInstance.post(ApiRoutes.voice.sessions, dto), "Could not start voice mode.");
export const sendVoiceText = (id: string, text: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.voice.text(id), { text }));
export const setVoiceVisual = (id: string, kind: VisualKind | null) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.voice.visual(id), { kind }));
export const sendVoiceSnapshot = (id: string, data_url: string) => request<{ ok: boolean; message_id: string }>(() => axiosInstance.post(ApiRoutes.voice.snapshot(id), { data_url }), "Could not post the snapshot.");
export const endVoiceSession = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.voice.one(id)));
