import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request, type Paginated } from "@/lib/request";
import type { Automation, AutomationInput, AutomationMemory, AutomationRun, AutomationStatus, AutomationUpdate } from "../interfaces/automations.interfaces";

const R = ApiRoutes.automations;

export const getAutomations = (params: { status?: AutomationStatus; bot_id?: string; search?: string } = {}) => request<Automation[]>(() => axiosInstance.get(R.root, { params }));
export const getAutomation = (id: string) => request<Automation>(() => axiosInstance.get(R.one(id)));
export const createAutomation = (dto: AutomationInput) => request<Automation>(() => axiosInstance.post(R.root, dto));
export const updateAutomation = (id: string, dto: AutomationUpdate) => request<Automation>(() => axiosInstance.patch(R.one(id), dto));
export const deleteAutomation = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(R.one(id)));
export const pauseAutomation = (id: string) => request<Automation>(() => axiosInstance.post(R.pause(id)));
export const resumeAutomation = (id: string) => request<Automation>(() => axiosInstance.post(R.resume(id)));
export const runAutomationNow = (id: string) => request<{ status: string; run_id?: string }>(() => axiosInstance.post(R.run(id)));
export const duplicateAutomation = (id: string) => request<Automation>(() => axiosInstance.post(R.duplicate(id)));
export const getAutomationRuns = (id: string, page = 1) => request<Paginated<AutomationRun>>(() => axiosInstance.get(R.runs(id), { params: { page, limit: 20 } }));
export const getAutomationMemory = (id: string) => request<AutomationMemory>(() => axiosInstance.get(R.memory(id)));
export const setAutomationMemory = (id: string, notes: Record<string, unknown>) => request<AutomationMemory>(() => axiosInstance.put(R.memory(id), { notes }));
export const resetAutomationMemory = (id: string) => request<AutomationMemory>(() => axiosInstance.delete(R.memory(id)));
export const confirmPreApprovals = (id: string) => request<Automation>(() => axiosInstance.post(R.confirm_pre_approvals(id)));
export const removePreApproval = (id: string, pid: string) => request<{ ok: boolean }>(() => axiosInstance.delete(R.pre_approval(id, pid)));
