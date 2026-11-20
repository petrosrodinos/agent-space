import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import {
  cleanupComputer, deleteComputerFile, getComputer, getComputerResources, getComputerFiles, getComputerSessions, getReplayFrames, getSignedInWebsites, handBack, importToComputer, pauseComputer, resetComputer,
  shareFromComputer, signOutWebsite, startComputer,
} from "../services/computers.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ComputerStatuses, type CleanupTarget } from "../interfaces/computers.interfaces";
import { formatBytes } from "@/lib/date";

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

const RESOURCES_REFRESH_MS = 10_000;
/**
 * Reading the numbers runs a command inside the computer, which can count as activity and stop it from pausing when idle.
 * So the card refreshes by itself only for this long after it was opened or last refreshed by hand (the browser also
 * pauses it while the tab is in the background).
 */
export const RESOURCES_AUTO_REFRESH_MS = 3 * 60_000;

/** CPU, memory and disk of the computer. Call `keepFresh()` (e.g. from the refresh button) to restart the auto-refresh window. */
export const useComputerResources = (botId: string, running: boolean) => {
  const [until, setUntil] = useState(() => Date.now() + RESOURCES_AUTO_REFRESH_MS);
  const [autoRefreshing, setAutoRefreshing] = useState(true);
  useEffect(() => {
    setAutoRefreshing(true);
    const t = setTimeout(() => setAutoRefreshing(false), Math.max(0, until - Date.now()));
    return () => clearTimeout(t);
  }, [until]);
  const query = useQuery({
    queryKey: [QueryKeys.COMPUTER, botId, "resources"],
    queryFn: () => getComputerResources(botId),
    refetchInterval: () => (running && Date.now() < until ? RESOURCES_REFRESH_MS : false),
    retry: false,
  });
  return { ...query, autoRefreshing: running && autoRefreshing, keepFresh: () => setUntil(Date.now() + RESOURCES_AUTO_REFRESH_MS) };
};

export const useCleanupComputer = (botId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targets: CleanupTarget[]) => cleanupComputer(botId, targets),
    onSuccess: ({ freed_bytes }) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.COMPUTER, botId] });
      const total = Object.values(freed_bytes).reduce((a, b) => a + (b ?? 0), 0);
      toast({ title: "Computer cleaned up", description: total > 0 ? `About ${formatBytes(total)} freed.` : "There was nothing to clear.", duration: 2500 });
    },
    onError: (e: Error) => toast({ title: "Could not clean up the computer", description: e.message, variant: "error" }),
  });
};
