import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { AddKnowledgeDto } from "../interfaces/knowledge.interfaces";
import { addKnowledge, deleteKnowledge, getKnowledge, updateKnowledge } from "../services/knowledge.services";
import { QueryKeys } from "@/config/constants/query-keys";

const key = (botId: string | null) => [QueryKeys.KNOWLEDGE, botId ?? "org"];

export const useKnowledge = (botId: string | null) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: key(botId), queryFn: () => getKnowledge(botId), enabled: !!org });
};

const useKnowledgeMutation = <T, R>(botId: string | null, fn: (v: T) => Promise<R>, success: string, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(botId) });
      qc.invalidateQueries({ queryKey: [QueryKeys.BOT] });
      toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useAddKnowledge = (botId: string | null) => useKnowledgeMutation(botId, (dto: AddKnowledgeDto) => addKnowledge(botId, dto), "Added to knowledge", "Could not add knowledge");
export const useUpdateKnowledge = (botId: string | null) => useKnowledgeMutation(botId, ({ id, ...dto }: { id: string; title?: string; content?: string }) => updateKnowledge(id, dto), "Saved", "Could not save");
export const useDeleteKnowledge = (botId: string | null) => useKnowledgeMutation(botId, deleteKnowledge, "Removed from knowledge", "Could not remove");
