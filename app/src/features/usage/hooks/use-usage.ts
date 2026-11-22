import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getActivity, getUsage, getUsageCharges, setUsageLimit } from "../services/usage.services";
import type { UsageChargesFilters } from "../interfaces/usage.interfaces";
import { QueryKeys } from "@/config/constants/query-keys";

export const useUsage = (period?: string) => useQuery({ queryKey: [QueryKeys.USAGE, period ?? "current"], queryFn: () => getUsage(period) });
export const useUsageCharges = (filters: UsageChargesFilters) => useQuery({ queryKey: [QueryKeys.USAGE, "charges", filters], queryFn: () => getUsageCharges(filters), placeholderData: keepPreviousData });
export const useActivity = (params: { page?: number; action?: string; actor_type?: string; search?: string }) => useQuery({ queryKey: [QueryKeys.ACTIVITY, params], queryFn: () => getActivity(params) });
export const useSetUsageLimit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setUsageLimit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.USAGE] });
      toast({ title: "Limit saved" });
    },
    onError: (e) => toast({ title: "Could not save the limit", description: e.message, variant: "error" }),
  });
};
