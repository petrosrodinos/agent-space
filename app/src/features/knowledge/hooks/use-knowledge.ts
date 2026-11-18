import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { AddKnowledgeDto, UpdateKnowledgeDto } from "../interfaces/knowledge.interfaces";
import { addKnowledge, deleteKnowledge, getKnowledge, getKnowledgeItem, updateKnowledge } from "../services/knowledge.services";
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
export const useUpdateKnowledge = (botId: string | null) => useKnowledgeMutation(botId, ({ id, ...dto }: { id: string } & UpdateKnowledgeDto) => updateKnowledge(id, dto), "Saved", "Could not save");
/** Full item (with its text) for the editor. */
export const useKnowledgeItem = (id: string | null) => useQuery({ queryKey: [QueryKeys.KNOWLEDGE, "item", id], queryFn: () => getKnowledgeItem(id!), enabled: !!id, gcTime: 0 });
export const useDeleteKnowledge = (botId: string | null) => useKnowledgeMutation(botId, deleteKnowledge, "Removed from knowledge", "Could not remove");
