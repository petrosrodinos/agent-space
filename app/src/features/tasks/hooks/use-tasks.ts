import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import { getApproval, getApprovals, getTask, getTasks, resolveApproval, startTask, undoStep } from "../services/tasks.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ALL_FILTER, ApprovalFilters, type ApprovalFilter } from "@/config/constants/filters";
import { ApprovalStatuses, RunTypes } from "@/features/tasks/interfaces/tasks.interfaces";
import { ApprovalDecisions, type ApprovalDecision } from "../interfaces/tasks.interfaces";
import { platform } from "@/platform";
import { BiometricResults, nativeBiometric } from "@/platform/native";

/** §13.4: on the Android app, approving a payment, a website password or an organisation-chosen action needs fingerprint / face unlock. */
const confirmOnPhone = async (id: string) => {
  if (!platform.is("android")) return;
  const approval = await getApproval(id);
  if (!approval.requires_biometric) return;
  const r = await nativeBiometric.verify(`Approve: ${approval.title}`);
  if (r === BiometricResults.UNAVAILABLE) throw new Error("Set up a fingerprint, face unlock or screen lock on this phone to approve this, or approve it on another device.");
  if (r !== BiometricResults.VERIFIED) throw new Error("Not approved: fingerprint / face unlock was cancelled.");
};

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

/** §16 Undo a bot's action; the message updates through the real-time stream. */
export const useUndoStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: undoStep,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.MESSAGES] });
      toast({ title: "Undone", description: r.label, duration: 2500 });
    },
    onError: (e: Error) => toast({ title: "Could not undo", description: e.message, variant: "error" }),
  });
};

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
    mutationFn: async ({ id, ...dto }: { id: string; decision: ApprovalDecision; edited_input?: Record<string, unknown> }) => {
      if (dto.decision === ApprovalDecisions.APPROVE) await confirmOnPhone(id);
      return resolveApproval(id, dto);
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.APPROVALS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.APPROVAL, a.id] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      toast({ title: a.status === ApprovalStatuses.REJECTED ? "Rejected" : "Approved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not answer", description: e.message, variant: "error" }),
  });
};
