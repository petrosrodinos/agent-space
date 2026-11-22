import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { CreateToolServerDto, ToolServer, ToolServerTestResult, UpdateToolServerDto } from "../interfaces/tool-servers.interfaces";

export const getToolServers = () => request<ToolServer[]>(() => axiosInstance.get(ApiRoutes.tool_servers.root));
export const getToolServer = (id: string) => request<ToolServer>(() => axiosInstance.get(ApiRoutes.tool_servers.one(id)));
/** Returns `authorization_url` when the server uses its own sign-in (standard MCP sign-in). */
export const createToolServer = (dto: CreateToolServerDto) => request<{ tool_server: ToolServer; authorization_url?: string | null }>(() => axiosInstance.post(ApiRoutes.tool_servers.root, dto), "Could not add the tool server.");
export const updateToolServer = (id: string, dto: UpdateToolServerDto) => request<ToolServer>(() => axiosInstance.patch(ApiRoutes.tool_servers.one(id), dto));
export const setToolServerToken = (id: string, token: string) => request<ToolServer>(() => axiosInstance.put(ApiRoutes.tool_servers.token(id), { token }));
export const startToolServerSignIn = (id: string) => request<{ authorization_url: string | null }>(() => axiosInstance.post(ApiRoutes.tool_servers.sign_in(id)));
export const completeToolServerSignIn = (dto: { state: string; code: string }) => request<ToolServer>(() => axiosInstance.post(ApiRoutes.tool_servers.sign_in_callback, dto));
export const testToolServer = (id: string) => request<ToolServerTestResult>(() => axiosInstance.post(ApiRoutes.tool_servers.test(id)));
export const deleteToolServer = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.tool_servers.one(id)));
