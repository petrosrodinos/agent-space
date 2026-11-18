import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request, type Paginated } from "@/lib/request";
import type { ActivityEntry, UsageOverview } from "../interfaces/usage.interfaces";
import { type UsageLimitScope } from "../interfaces/usage.interfaces";

export const getUsage = (period?: string) => request<UsageOverview>(() => axiosInstance.get(ApiRoutes.usage.root, { params: { period } }));
export const setUsageLimit = (dto: { scope: UsageLimitScope; user_id?: string; bot_id?: string; monthly_limit: number | null }) => request<{ ok: boolean }>(() => axiosInstance.put(ApiRoutes.usage.limits, dto));
export const getActivity = (params: { page?: number; action?: string; actor_type?: string; search?: string }) => request<Paginated<ActivityEntry>>(() => axiosInstance.get(ApiRoutes.activity.root, { params: { ...params, limit: 30 } }));
