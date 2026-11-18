import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { AutomationStatus, AutomationUpdate } from "../interfaces/automations.interfaces";
import {
  confirmPreApprovals, createAutomation, deleteAutomation, duplicateAutomation, getAutomation, getAutomationMemory, getAutomationRuns, getAutomations, pauseAutomation,
  removePreApproval, resetAutomationMemory, resumeAutomation, runAutomationNow, setAutomationMemory, updateAutomation,
} from "../services/automations.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ALL_FILTER } from "@/config/constants/filters";

const useOrgReady = () => !!useOrganizationStore((s) => s.current_id);

export const useAutomations = (status?: AutomationStatus) => useQuery({ queryKey: [QueryKeys.AUTOMATIONS, status ?? ALL_FILTER], queryFn: () => getAutomations(status ? { status } : {}), enabled: useOrgReady() });
/** Automations of one bot (bot side panel). */
export const useBotAutomations = (botId: string) => {
  const ready = useOrgReady();
  return useQuery({ queryKey: [QueryKeys.AUTOMATIONS, "bot", botId], queryFn: () => getAutomations({ bot_id: botId }), enabled: !!botId && ready });
};
export const useAutomation = (id: string) => {
  const ready = useOrgReady();
  return useQuery({ queryKey: [QueryKeys.AUTOMATION, id], queryFn: () => getAutomation(id), enabled: !!id && ready });
};
export const useAutomationRuns = (id: string, page = 1) => useQuery({ queryKey: [QueryKeys.AUTOMATION, id, "runs", page], queryFn: () => getAutomationRuns(id, page), enabled: !!id, refetchInterval: 15_000 });
export const useAutomationMemory = (id: string, enabled = true) => useQuery({ queryKey: [QueryKeys.AUTOMATION, id, "memory"], queryFn: () => getAutomationMemory(id), enabled: !!id && enabled });

/** Every automation mutation refreshes the list and the one automation (with its runs and memory). */
function useAutomationMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string | null, failure: string, idOf?: (args: TArgs) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.AUTOMATIONS] });
      const id = idOf?.(args);
      if (id) qc.invalidateQueries({ queryKey: [QueryKeys.AUTOMATION, id] });
      if (success) toast({ title: success, duration: 2000 });
    },
    onError: (e) => toast({ title: failure, description: e.message, variant: "error" }),
  });
}

export const useCreateAutomation = () => useAutomationMutation(createAutomation, "Automation saved", "Could not save the automation");
export const useUpdateAutomation = () => useAutomationMutation(({ id, ...dto }: { id: string } & AutomationUpdate) => updateAutomation(id, dto), "Automation saved", "Could not save", (a) => a.id);
export const useDeleteAutomation = () => useAutomationMutation(deleteAutomation, "Automation deleted", "Could not delete");
export const usePauseAutomation = () => useAutomationMutation(pauseAutomation, "Paused", "Could not pause", (id) => id);
export const useResumeAutomation = () => useAutomationMutation(resumeAutomation, "Resumed", "Could not resume", (id) => id);
export const useRunAutomationNow = () => useAutomationMutation(runAutomationNow, "Running now — results will appear in its conversation", "Could not run it", (id) => id);
export const useDuplicateAutomation = () => useAutomationMutation(duplicateAutomation, "Copy created (paused)", "Could not duplicate");
export const useSetAutomationMemory = () => useAutomationMutation(({ id, notes }: { id: string; notes: Record<string, unknown> }) => setAutomationMemory(id, notes), "Memory saved", "Could not save memory", (a) => a.id);
export const useResetAutomationMemory = () => useAutomationMutation(resetAutomationMemory, "Memory reset — the next run starts fresh", "Could not reset memory", (id) => id);
export const useConfirmPreApprovals = () => useAutomationMutation(confirmPreApprovals, "Pre-approvals confirmed", "Could not confirm", (id) => id);
export const useRemovePreApproval = () => useAutomationMutation(({ id, pid }: { id: string; pid: string }) => removePreApproval(id, pid), "Pre-approval removed", "Could not remove", (a) => a.id);
