import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { CreateCredentialDto } from "../interfaces/connections.interfaces";
import {
  addApiKeyConnection, cancelSecretRequest, completeConnection, connectService, createCredential, deleteConnection, deleteCredential, getCatalog, getCategories, getConnections,
  getCredentialHistory, getCredentialUsage, getCredentials, reconnectConnection, replaceCredential, setServiceDefault, updateConnection, updateCredential,
} from "../services/connections.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { type Visibility } from "@/features/connections/interfaces/connections.interfaces";

const useOrgReady = () => !!useOrganizationStore((s) => s.current_id);

export const useConnections = () => useQuery({ queryKey: [QueryKeys.CONNECTIONS], queryFn: getConnections, enabled: useOrgReady() });
export const useCategories = () => useQuery({ queryKey: [QueryKeys.CONNECTION_CATEGORIES], queryFn: getCategories, enabled: useOrgReady(), staleTime: 60 * 60_000 });
export const useCatalog = (search: string, category: string) =>
  useInfiniteQuery({
    queryKey: [QueryKeys.CONNECTION_CATALOG, search, category],
    queryFn: ({ pageParam }) => getCatalog({ search: search || undefined, category: category || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: useOrgReady(),
    staleTime: 5 * 60_000,
  });

export const useConnectService = () =>
  useMutation({ mutationFn: connectService, onError: (e) => toast({ title: "Could not start connecting", description: e.message, variant: "error" }) });

export const useCompleteConnection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: completeConnection, onSuccess: () => qc.invalidateQueries({ queryKey: [QueryKeys.CONNECTIONS] }) });
};

export const useReconnect = () => useMutation({ mutationFn: ({ id, return_url }: { id: string; return_url?: string }) => reconnectConnection(id, return_url), onError: (e) => toast({ title: "Could not reconnect", description: e.message, variant: "error" }) });

const useConnMutation = <T, R = unknown>(fn: (v: T) => Promise<R>, success: string, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.CONNECTIONS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CREDENTIALS] });
      toast({ title: success, duration: 1600 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useUpdateConnection = () => useConnMutation(({ id, ...dto }: { id: string; label?: string; visibility?: Visibility; restricted_bot_ids?: string[] }) => updateConnection(id, dto), "Connection saved", "Could not save");
export const useDeleteConnection = () => useConnMutation(deleteConnection, "Disconnected", "Could not disconnect");
export const useAddApiKeyConnection = () => useConnMutation(addApiKeyConnection, "Key saved securely", "Could not save the key");
export const useSetServiceDefault = () => useConnMutation(setServiceDefault, "Default account set", "Could not set default");

export const useCredentials = (params: { search?: string; service?: string; status?: string; bot_id?: string } = {}) => useQuery({ queryKey: [QueryKeys.CREDENTIALS, params], queryFn: () => getCredentials(params), enabled: useOrgReady() });
export const useCreateCredential = () => useConnMutation((dto: CreateCredentialDto) => createCredential(dto), "Saved securely", "Could not save the secret");
export const useCancelSecretRequest = () => useMutation({ mutationFn: cancelSecretRequest, onError: (e) => toast({ title: "Could not cancel", description: e.message, variant: "error" }) });
export const useUpdateCredential = () => useConnMutation(({ id, ...dto }: { id: string; label?: string; service_name?: string; bot_ids?: string[]; visibility?: Visibility }) => updateCredential(id, dto), "Secret updated", "Could not update");
export const useReplaceCredential = () => useConnMutation(({ id, ...dto }: { id: string; value: string; request?: { run_id: string; request_id: string } }) => replaceCredential(id, dto), "Secret replaced", "Could not replace");
export const useDeleteCredential = () => useConnMutation(deleteCredential, "Secret deleted", "Could not delete");
export const useCredentialUsage = (id: string | null) => useQuery({ queryKey: [QueryKeys.CREDENTIAL_USAGE, id], queryFn: () => getCredentialUsage(id!), enabled: !!id });
export const useCredentialHistory = (id: string | null) => useQuery({ queryKey: [QueryKeys.CREDENTIAL_HISTORY, id], queryFn: () => getCredentialHistory(id!), enabled: !!id });
