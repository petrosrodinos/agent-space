import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { Connection, CreateCredentialDto, Credential, CredentialEvent, ReplaceCredentialDto, ServiceDetails, ToolPermission, Toolkit } from "../interfaces/connections.interfaces";
import { type Visibility } from "../interfaces/connections.interfaces";

export const getConnections = () => request<Connection[]>(() => axiosInstance.get(ApiRoutes.connections.root));
export const getCatalog = (params: { search?: string; category?: string; cursor?: string }) => request<{ items: Toolkit[]; next_cursor: string | null }>(() => axiosInstance.get(ApiRoutes.connections.catalog, { params }));
export const getCategories = () => request<{ id: string; name: string }[]>(() => axiosInstance.get(ApiRoutes.connections.categories));
export const connectService = (dto: { toolkit: string; label?: string; visibility?: Visibility; return_url?: string }) => request<{ connection_id: string; redirect_url: string | null; status?: string }>(() => axiosInstance.post(ApiRoutes.connections.composio, dto));
export const completeConnection = (id: string) => request<{ connection_id: string; service_key: string; status: string; label: string; account_identifier: string | null }>(() => axiosInstance.post(ApiRoutes.connections.complete(id)));
export const reconnectConnection = (id: string, return_url?: string) => request<{ connection_id: string; redirect_url: string | null }>(() => axiosInstance.post(ApiRoutes.connections.reconnect(id), { return_url }));
export const updateConnection = (id: string, dto: { label?: string; visibility?: Visibility; restricted_bot_ids?: string[] }) => request<Connection>(() => axiosInstance.patch(ApiRoutes.connections.one(id), dto));
export const deleteConnection = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.connections.one(id)));
export const addApiKeyConnection = (dto: { service_name: string; label: string; api_key: string; visibility?: Visibility; bot_ids?: string[] }) => request<Connection>(() => axiosInstance.post(ApiRoutes.connections.api_key, dto));
export const getServiceDetails = (slug: string) => request<ServiceDetails>(() => axiosInstance.get(ApiRoutes.connections.service(slug)));
export const setToolPermissions = (slug: string, dto: { tool_slugs: string[]; permission: ToolPermission }) => request<{ ok: boolean }>(() => axiosInstance.put(ApiRoutes.connections.service_permissions(slug), dto));
export const setServiceDefault = (dto: { service_key: string; connection_id: string }) => request<{ ok: boolean }>(() => axiosInstance.put(ApiRoutes.connections.defaults, dto));

export const getCredentials = (params: { search?: string; service?: string; status?: string; bot_id?: string } = {}) => request<Credential[]>(() => axiosInstance.get(ApiRoutes.credentials.root, { params }));
/** The secret value goes straight to the API over HTTPS; it never passes through the chat stream (§8.8). */
export const createCredential = (dto: CreateCredentialDto) => request<Credential>(() => axiosInstance.post(ApiRoutes.credentials.root, dto));
export const cancelSecretRequest = (dto: { run_id: string; request_id: string }) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.credentials.cancel_request, { request: dto }));
export const updateCredential = (id: string, dto: { label?: string; service_name?: string; bot_ids?: string[]; visibility?: Visibility }) => request<Credential>(() => axiosInstance.patch(ApiRoutes.credentials.one(id), dto));
export const replaceCredential = (id: string, dto: ReplaceCredentialDto) => request<Credential>(() => axiosInstance.post(ApiRoutes.credentials.replace(id), dto));
export const deleteCredential = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.credentials.one(id)));
export const getCredentialUsage = (id: string) => request<{ bots: { id: string; name: string; emoji: string }[]; tool_servers: { id: string; name: string }[] }>(() => axiosInstance.get(ApiRoutes.credentials.usage(id)));
export const getCredentialHistory = (id: string) => request<CredentialEvent[]>(() => axiosInstance.get(ApiRoutes.credentials.history(id)));
