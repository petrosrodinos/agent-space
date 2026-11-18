import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import { getApproval, getApprovals, getTask, getTasks, resolveApproval, startTask } from "../services/tasks.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ALL_FILTER, ApprovalFilters, type ApprovalFilter } from "@/config/constants/filters";
import { ApprovalStatuses, RunTypes } from "@/features/tasks/interfaces/tasks.interfaces";
import { type ApprovalDecision } from "../interfaces/tasks.interfaces";

export const useTasks = (status?: string, page = 1) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.TASKS, status ?? ALL_FILTER, page], queryFn: () => getTasks({ status, page, limit: 20 }), enabled: !!org });
};
/** Recent long-running tasks of one bot (bot side panel). */
export const useBotTasks = (botId: string, limit = 5) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.TASKS, "bot", botId, limit], queryFn: () => getTasks({ bot_id: botId, type: RunTypes.TASK, page: 1, limit }), enabled: !!org && !!botId, refetchInterval: 15_000 });
};
export const useTask = (id: string) => useQuery({ queryKey: [QueryKeys.TASK, id], queryFn: () => getTask(id), enabled: !!id });

export const useStartTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.TASKS] });
      toast({ title: "Task started", description: "You can leave — I'll keep working and let you know." });
    },
    onError: (e) => toast({ title: "Could not start the task", description: e.message, variant: "error" }),
  });
};

export const useApprovals = (status: ApprovalFilter = ApprovalFilters.PENDING) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.APPROVALS, status], queryFn: () => getApprovals(status), enabled: !!org });
};
export const useApproval = (id: string) => useQuery({ queryKey: [QueryKeys.APPROVAL, id], queryFn: () => getApproval(id), enabled: !!id });

export const useResolveApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; decision: ApprovalDecision; edited_input?: Record<string, unknown> }) => resolveApproval(id, dto),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.APPROVALS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.APPROVAL, a.id] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      toast({ title: a.status === ApprovalStatuses.REJECTED ? "Rejected" : "Approved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not answer", description: e.message, variant: "error" }),
  });
};
