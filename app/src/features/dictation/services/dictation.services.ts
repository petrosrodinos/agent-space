import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";

/**
 * Sends one recording for transcription. The server neither stores the audio nor logs the text.
 * The instance defaults to JSON, which would make axios serialise the FormData; multipart lets the browser set the boundary.
 */
export const transcribeDictation = (audio: Blob) => {
  const form = new FormData();
  form.append("audio", audio, "dictation");
  return request<{ text: string }>(() => axiosInstance.post(ApiRoutes.dictation.transcribe, form, { headers: { "Content-Type": "multipart/form-data" } }), "Could not transcribe the recording.");
};
