import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { Device, MeResponse, SessionInfo, UpdateProfileDto, User, UserSettings } from "../interfaces/users.interfaces";
import { Platforms } from "../interfaces/users.interfaces";

export const getMe = () => request<MeResponse>(() => axiosInstance.get(ApiRoutes.me.root));
export const updateProfile = (dto: UpdateProfileDto) => request<User>(() => axiosInstance.patch(ApiRoutes.me.root, dto));
export const updateSettings = (dto: Partial<UserSettings>) => request<UserSettings>(() => axiosInstance.patch(ApiRoutes.me.settings, dto));
export const deleteAccount = (password: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.me.delete_account, { password }));
export const getDevices = () => request<Device[]>(() => axiosInstance.get(ApiRoutes.me.devices));
export const renameDevice = (id: string, name: string) => request<{ ok: boolean }>(() => axiosInstance.patch(ApiRoutes.me.device(id), { name }));
export const signOutDevice = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.me.device(id)));
export const getSessions = () => request<SessionInfo[]>(() => axiosInstance.get(ApiRoutes.auth.sessions));
export const revokeSession = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.auth.session(id)));
export const revokeOtherSessions = () => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.auth.revoke_others));
export const heartbeat = (dto: { app_version: string; capabilities: string[] }) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.me.heartbeat, dto));
export const getVersionPolicy = () => request<{ minimum_version: string; latest_version: string | null }>(() => axiosInstance.get(ApiRoutes.app.version, { params: { platform: Platforms.WEB } }));
