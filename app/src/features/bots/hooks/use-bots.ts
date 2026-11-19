import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { ActionType, UpdateBotDto } from "../interfaces/bots.interfaces";
import {
  addBotMemory, addOrgMemory, clearAllMemories, clearBotMemories, createBot, deleteBot, deleteMemory, draftBot, duplicateBot, getBot, getBotMemories, getBots, getModels, getMyMemories, getOrgMemories,
  getTemplates, getVoices, setApprovalRules, setBotConnections, updateBot, updateMemory,
} from "../services/bots.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { type ApprovalOverrideChoice } from "@/features/bots/interfaces/bots.interfaces";

const useOrgReady = () => !!useOrganizationStore((s) => s.current_id);

export const useModels = () => useQuery({ queryKey: [QueryKeys.MODELS], queryFn: getModels, enabled: useOrgReady(), staleTime: 5 * 60_000 });
export const useVoices = () => useQuery({ queryKey: [QueryKeys.VOICES], queryFn: getVoices, enabled: useOrgReady(), staleTime: Infinity });
export const useTemplates = () => useQuery({ queryKey: [QueryKeys.BOT_TEMPLATES], queryFn: getTemplates, enabled: useOrgReady(), staleTime: 5 * 60_000 });
export const useBots = (search?: string) => useQuery({ queryKey: [QueryKeys.BOTS, search ?? ""], queryFn: () => getBots(search), enabled: useOrgReady() });
export const useBot = (id: string) => useQuery({ queryKey: [QueryKeys.BOT, id], queryFn: () => getBot(id), enabled: useOrgReady() && !!id });

export const useCreateBot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBot,
    onSuccess: (bot) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.BOTS] });
      toast({ title: `Say hi to ${bot.emoji} ${bot.name}!` });
    },
    onError: (e) => toast({ title: "Could not create the bot", description: e.message, variant: "error" }),
  });
};

export const useDraftBot = () => useMutation({ mutationFn: draftBot, onError: (e) => toast({ title: "Could not draft the bot", description: e.message, variant: "error" }) });

export const useUpdateBot = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateBotDto) => updateBot(id, dto),
    onSuccess: (bot) => {
      qc.setQueryData([QueryKeys.BOT, id], bot);
      qc.invalidateQueries({ queryKey: [QueryKeys.BOTS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      toast({ title: "Bot saved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not save the bot", description: e.message, variant: "error" }),
  });
};

export const useDeleteBot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.BOTS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      toast({ title: "Bot deleted" });
    },
    onError: (e) => toast({ title: "Could not delete the bot", description: e.message, variant: "error" }),
  });
};

export const useDuplicateBot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateBot,
    onSuccess: (bot) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.BOTS] });
      toast({ title: `${bot.name} created` });
    },
    onError: (e) => toast({ title: "Could not duplicate the bot", description: e.message, variant: "error" }),
  });
};

export const useSetApprovalRules = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: { action_type: ActionType; override: ApprovalOverrideChoice }[]) => setApprovalRules(id, rules),
    onSuccess: (bot) => {
      qc.setQueryData([QueryKeys.BOT, id], bot);
      toast({ title: "Approval rules saved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not save approval rules", description: e.message, variant: "error" }),
  });
};

export const useSetBotConnections = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connections: { connection_id: string; is_default_for_service?: boolean }[]) => setBotConnections(id, connections),
    onSuccess: (bot) => {
      qc.setQueryData([QueryKeys.BOT, id], bot);
      toast({ title: "Connections saved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not save connections", description: e.message, variant: "error" }),
  });
};

export const useBotMemories = (botId: string) => useQuery({ queryKey: [QueryKeys.BOT_MEMORIES, botId], queryFn: () => getBotMemories(botId), enabled: !!botId });
export const useMyMemories = () => useQuery({ queryKey: [QueryKeys.MY_MEMORIES], queryFn: getMyMemories, enabled: useOrgReady() });
export const useOrgMemories = () => useQuery({ queryKey: [QueryKeys.ORG_MEMORIES], queryFn: getOrgMemories, enabled: useOrgReady() });

const useMemoryMutation = <T,>(fn: (v: T) => Promise<unknown>, title: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.BOT_MEMORIES] });
      qc.invalidateQueries({ queryKey: [QueryKeys.ORG_MEMORIES] });
      qc.invalidateQueries({ queryKey: [QueryKeys.MY_MEMORIES] });
      qc.invalidateQueries({ queryKey: [QueryKeys.BOT] });
      toast({ title, duration: 1500 });
    },
    onError: (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "error" }),
  });
};

export const useUpdateMemory = () => useMemoryMutation(({ id, content }: { id: string; content: string }) => updateMemory(id, content), "Memory updated");
export const useDeleteMemory = () => useMemoryMutation(deleteMemory, "Forgotten");
export const useClearBotMemories = () => useMemoryMutation(clearBotMemories, "Memories cleared");
export const useClearAllMemories = () => useMemoryMutation(() => clearAllMemories(), "All memories cleared");
export const useAddBotMemory = () => useMemoryMutation(({ botId, content }: { botId: string; content: string }) => addBotMemory(botId, content), "Memory saved");
export const useAddOrgMemory = () => useMemoryMutation(addOrgMemory, "Company fact saved");
