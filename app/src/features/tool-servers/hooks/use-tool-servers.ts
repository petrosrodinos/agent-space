import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { CreateToolServerDto, UpdateToolServerDto } from "../interfaces/tool-servers.interfaces";
import { getToolServer, completeToolServerSignIn, createToolServer, deleteToolServer, getToolServers, setToolServerToken, startToolServerSignIn, testToolServer, updateToolServer } from "../services/tool-servers.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { ToolServerStatuses } from "../interfaces/tool-servers.interfaces";

export const useToolServers = () => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.TOOL_SERVERS], queryFn: getToolServers, enabled: !!org });
};

const useToolServerMutation = <T, R>(fn: (v: T) => Promise<R>, success: string | ((r: R) => string | null) | null, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r: R) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.TOOL_SERVERS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONNECTIONS] });
      const title = typeof success === "function" ? success(r) : success;
      if (title) toast({ title, duration: 2000 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useCreateToolServer = () =>
  useToolServerMutation((dto: CreateToolServerDto) => createToolServer(dto), (r) => (r.authorization_url ? null : r.tool_server.status === ToolServerStatuses.ACTIVE ? `${r.tool_server.name} added — ${r.tool_server.tool_count} tools` : `${r.tool_server.name} added, but it couldn't connect yet`), "Could not add the tool server");
export const useUpdateToolServer = () => useToolServerMutation(({ id, ...dto }: { id: string } & UpdateToolServerDto) => updateToolServer(id, dto), "Tool server updated", "Could not update the tool server");
export const useSetToolServerToken = () => useToolServerMutation(({ id, token }: { id: string; token: string }) => setToolServerToken(id, token), "Access token replaced", "Could not replace the token");
export const useStartToolServerSignIn = () => useToolServerMutation(startToolServerSignIn, null, "Could not start the sign-in");
export const useCompleteToolServerSignIn = () => useToolServerMutation(completeToolServerSignIn, null, "Sign-in failed");
export const useTestToolServer = () =>
  useToolServerMutation(testToolServer, (r) => (r.ok ? `Connected — ${r.tool_count} tools available` : null), "Could not test the tool server");
export const useDeleteToolServer = () => useToolServerMutation(deleteToolServer, "Tool server removed", "Could not remove the tool server");

export const useToolServer = (id: string) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.TOOL_SERVERS, id], queryFn: () => getToolServer(id), enabled: !!org && !!id });
};
