import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request, type Paginated } from "@/lib/request";
import type { Approval, Task, TaskDetail } from "../interfaces/tasks.interfaces";
import { ApprovalFilters, type ApprovalFilter } from "@/config/constants/filters";
import { type ApprovalDecision, type RunType } from "../interfaces/tasks.interfaces";

export const getTasks = (params: { status?: string; bot_id?: string; type?: RunType; page?: number; limit?: number }) => request<Paginated<Task>>(() => axiosInstance.get(ApiRoutes.tasks.root, { params }));
export const getTask = (id: string) => request<TaskDetail>(() => axiosInstance.get(ApiRoutes.tasks.one(id)));
export const startTask = (dto: { bot_id: string; prompt: string }) => request<{ conversation_id: string; runs: { id: string }[] }>(() => axiosInstance.post(ApiRoutes.tasks.root, dto));
export const provideRunInput = (runId: string, dto: { request_id: string; result: Record<string, unknown> }) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.runs.input(runId), dto));
export const getApprovals = (status: ApprovalFilter = ApprovalFilters.PENDING) => request<Approval[]>(() => axiosInstance.get(ApiRoutes.approvals.root, { params: { status } }));
export const getApproval = (id: string) => request<Approval>(() => axiosInstance.get(ApiRoutes.approvals.one(id)));
export const resolveApproval = (id: string, dto: { decision: ApprovalDecision; edited_input?: Record<string, unknown> }) => request<Approval>(() => axiosInstance.post(ApiRoutes.approvals.resolve(id), dto));
