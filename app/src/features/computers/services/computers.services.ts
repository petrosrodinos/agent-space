import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { ComputerFolder, ComputerSession, ComputerView, LiveView, ReplayFrame, SignedInWebsite } from "../interfaces/computers.interfaces";

const R = ApiRoutes.computers;

export const getComputer = (botId: string) => request<ComputerView>(() => axiosInstance.get(R.root(botId)));
export const startComputer = (botId: string) => request<ComputerView>(() => axiosInstance.post(R.start(botId)), "The computer could not start.");
export const pauseComputer = (botId: string) => request<ComputerView>(() => axiosInstance.post(R.pause(botId)));
export const resetComputer = (botId: string) => request<ComputerView>(() => axiosInstance.post(R.reset(botId)));
export const getLiveView = (botId: string) => request<LiveView>(() => axiosInstance.post(R.live_view(botId)), "Could not open the computer.");
export const takeControl = (botId: string) => request<LiveView>(() => axiosInstance.post(R.take_control(botId)), "Could not take control.");
export const handBack = (botId: string) => request<{ ok: boolean }>(() => axiosInstance.post(R.hand_back(botId)));
export const getComputerSessions = (botId: string) => request<ComputerSession[]>(() => axiosInstance.get(R.sessions(botId)));
export const getReplayFrames = (botId: string, sessionId: string) => request<ReplayFrame[]>(() => axiosInstance.get(R.frames(botId, sessionId)));
export const getComputerFiles = (botId: string, path?: string) => request<ComputerFolder>(() => axiosInstance.get(R.files(botId), { params: { path } }));
export const importToComputer = (botId: string, dto: { file_id: string; folder?: string }) => request<{ path: string }>(() => axiosInstance.post(R.import(botId), dto), "Could not copy the file to the computer.");
export const shareFromComputer = (botId: string, dto: { path: string; conversation_id: string }) => request<{ message_id: string }>(() => axiosInstance.post(R.share(botId), dto));
export const deleteComputerFile = (botId: string, path: string) => request<{ ok: boolean }>(() => axiosInstance.post(R.delete_file(botId), { path }));
export const getSignedInWebsites = (botId: string) => request<SignedInWebsite[]>(() => axiosInstance.get(R.websites(botId)));
export const signOutWebsite = (botId: string, domain: string | null) => request<{ ok: boolean }>(() => axiosInstance.delete(domain ? R.website(botId, domain) : R.websites(botId)));

/** Downloads a file from the computer through the API (no direct links to the sandbox). */
export async function downloadComputerFile(botId: string, path: string) {
  const blob = await request<Blob>(() => axiosInstance.get(R.download(botId), { params: { path }, responseType: "blob" }), "Could not download the file.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop() || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
