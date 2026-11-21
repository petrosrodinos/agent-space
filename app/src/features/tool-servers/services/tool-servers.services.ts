import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { CreateToolServerDto, ToolServer, ToolServerTestResult, UpdateToolServerDto } from "../interfaces/tool-servers.interfaces";

export const getToolServers = () => request<ToolServer[]>(() => axiosInstance.get(ApiRoutes.tool_servers.root));
/** Returns `authorization_url` when the server uses its own sign-in; it finishes on /connections/callback. */
export const createToolServer = (dto: CreateToolServerDto) => request<{ tool_server: ToolServer; authorization_url?: string | null }>(() => axiosInstance.post(ApiRoutes.tool_servers.root, dto), "Could not add the tool server.");
export const updateToolServer = (id: string, dto: UpdateToolServerDto) => request<ToolServer>(() => axiosInstance.patch(ApiRoutes.tool_servers.one(id), dto));
export const setToolServerToken = (id: string, token: string) => request<ToolServer>(() => axiosInstance.put(ApiRoutes.tool_servers.token(id), { token }));
export const startToolServerSignIn = ({ id, return_url }: { id: string; return_url?: string }) => request<{ authorization_url: string | null }>(() => axiosInstance.post(ApiRoutes.tool_servers.sign_in(id), { return_url }));
export const testToolServer = (id: string) => request<ToolServerTestResult>(() => axiosInstance.post(ApiRoutes.tool_servers.test(id)));
export const deleteToolServer = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.tool_servers.one(id)));
