import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import {
  deleteComputerFile, getComputer, getComputerFiles, getComputerSessions, getReplayFrames, getSignedInWebsites, handBack, importToComputer, pauseComputer, resetComputer,
  shareFromComputer, signOutWebsite, startComputer,
} from "../services/computers.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ComputerStatuses } from "../interfaces/computers.interfaces";

export const useComputer = (botId: string | undefined, enabled = true) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({
    queryKey: [QueryKeys.COMPUTER, botId],
    queryFn: () => getComputer(botId!),
    enabled: !!org && !!botId && enabled,
    // While starting, poll until it's running (the status event usually arrives first).
    refetchInterval: (q) => (q.state.data?.status === ComputerStatuses.STARTING ? 3000 : false),
  });
};

export const useComputerSessions = (botId: string, enabled = true) => useQuery({ queryKey: [QueryKeys.COMPUTER, botId, "sessions"], queryFn: () => getComputerSessions(botId), enabled });
export const useReplayFrames = (botId: string, sessionId: string | null) => useQuery({ queryKey: [QueryKeys.COMPUTER, botId, "frames", sessionId], queryFn: () => getReplayFrames(botId, sessionId!), enabled: !!sessionId, staleTime: 4 * 60_000 });
export const useComputerFiles = (botId: string, path: string | undefined, enabled = true) =>
  useQuery({ queryKey: [QueryKeys.COMPUTER, botId, "files", path ?? ""], queryFn: () => getComputerFiles(botId, path), enabled, retry: false });
export const useSignedInWebsites = (botId: string, enabled = true) => useQuery({ queryKey: [QueryKeys.COMPUTER, botId, "websites"], queryFn: () => getSignedInWebsites(botId), enabled, retry: false });

const useComputerMutation = <T, R>(botId: string, fn: (v: T) => Promise<R>, success: string | null, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.COMPUTER, botId] });
      if (success) toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useStartComputer = (botId: string) => useComputerMutation(botId, () => startComputer(botId), "The computer is on", "Could not turn the computer on");
export const usePauseComputer = (botId: string) => useComputerMutation(botId, () => pauseComputer(botId), "The computer is paused", "Could not pause the computer");
export const useResetComputer = (botId: string) => useComputerMutation(botId, () => resetComputer(botId), "The computer was reset", "Could not reset the computer");
export const useHandBack = (botId: string) => useComputerMutation(botId, () => handBack(botId), null, "Could not hand control back");
export const useImportToComputer = (botId: string) => useComputerMutation(botId, (dto: { file_id: string; folder?: string }) => importToComputer(botId, dto), "Copied to the computer", "Could not copy the file");
export const useDeleteComputerFile = (botId: string) => useComputerMutation(botId, (path: string) => deleteComputerFile(botId, path), "Deleted", "Could not delete");
export const useShareFromComputer = (botId: string) => useComputerMutation(botId, (dto: { path: string; conversation_id: string }) => shareFromComputer(botId, dto), "Shared into the chat", "Could not share the file");
export const useSignOutWebsite = (botId: string) => useComputerMutation(botId, (domain: string | null) => signOutWebsite(botId, domain), "Signed out", "Could not sign out");
