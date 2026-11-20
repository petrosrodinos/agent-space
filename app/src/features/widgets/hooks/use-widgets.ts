import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import { QueryKeys } from "@/config/constants/query-keys";
import { createWidget, deleteWidget, getWidget, getWidgets, refreshWidget, updateWidget } from "../services/widgets.services";

export const useWidgets = () => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.WIDGETS, org], queryFn: getWidgets, enabled: !!org });
};

export const useWidget = (id: string) => useQuery({ queryKey: [QueryKeys.WIDGET, id], queryFn: () => getWidget(id), enabled: !!id });

const useWidgetMutation = <T, R = unknown>(fn: (v: T) => Promise<R>, success: string | null, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.WIDGETS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.WIDGET] });
      if (success) toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useCreateWidget = () => useWidgetMutation(createWidget, "Saved as a widget — find it under Widgets", "Could not save the widget");
export const useUpdateWidget = () => useWidgetMutation(updateWidget, "Widget updated", "Could not update the widget");
export const useDeleteWidget = () => useWidgetMutation(deleteWidget, "Widget deleted", "Could not delete the widget");
export const useRefreshWidget = () => useWidgetMutation(refreshWidget, null, "Could not refresh the widget");
