import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { SkillFormDto, SkillSharing, SkillTab } from "../interfaces/skills.interfaces";
import { addSkillFile, addStarterSkill, removeSkillFile, createSkill, deleteSkill, exportSkill, getSkill, getSkills, importSkill, restoreSkill, restoreSkillVersion, setBotSkills, setSkillBots, shareSkill, updateSkill } from "../services/skills.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { SkillTabs, type SkillShareRole } from "../interfaces/skills.interfaces";

export const useSkills = (tab: SkillTab = SkillTabs.ALL, search?: string) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.SKILLS, tab, search ?? ""], queryFn: () => getSkills(tab, search), enabled: !!org });
};
export const useSkill = (id: string) => useQuery({ queryKey: [QueryKeys.SKILL, id], queryFn: () => getSkill(id), enabled: !!id });

const useSkillMutation = <T, R = unknown>(fn: (v: T) => Promise<R>, success: string | ((r: R) => string), fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r: R) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.SKILLS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.SKILL] });
      qc.invalidateQueries({ queryKey: [QueryKeys.BOT] });
      toast({ title: typeof success === "function" ? success(r) : success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useCreateSkill = () => useSkillMutation(createSkill, (s) => `${s.name} saved`, "Could not create the skill");
export const useUpdateSkill = () => useSkillMutation(({ id, ...dto }: { id: string } & Partial<SkillFormDto>) => updateSkill(id, dto), "Saved as a new version", "Could not save the skill");
export const useDeleteSkill = () => useSkillMutation(deleteSkill, "Skill deleted — restorable for 30 days", "Could not delete the skill");
export const useRestoreSkill = () => useSkillMutation(restoreSkill, "Skill restored", "Could not restore");
export const useRestoreSkillVersion = () => useSkillMutation(({ id, version }: { id: string; version: number }) => restoreSkillVersion(id, version), "Version restored", "Could not restore that version");
export const useShareSkill = () => useSkillMutation(({ id, ...dto }: { id: string; sharing_level: SkillSharing; shares?: { user_id: string; role: SkillShareRole }[] }) => shareSkill(id, dto), "Sharing updated", "Could not update sharing");
export const useSetSkillBots = () => useSkillMutation(({ id, bot_ids }: { id: string; bot_ids: string[] }) => setSkillBots(id, bot_ids), "Bots updated", "Could not update bots");
export const useSetBotSkills = () => useSkillMutation(({ botId, skill_ids }: { botId: string; skill_ids: string[] }) => setBotSkills(botId, skill_ids), "Skills updated", "Could not update skills");
export const useAddStarterSkill = () => useSkillMutation(addStarterSkill, (s) => `${s.name} added to your skills`, "Could not add the skill");
export const useImportSkill = () => useSkillMutation(importSkill, (s) => `${s.name} imported`, "Could not import the skill");
export const useExportSkill = () => useMutation({ mutationFn: exportSkill, onError: (e) => toast({ title: "Could not export", description: e.message, variant: "error" }) });
export const useAddSkillFile = () => useSkillMutation(({ id, file_id }: { id: string; file_id: string }) => addSkillFile(id, file_id), "File attached", "Could not attach the file");
export const useRemoveSkillFile = () => useSkillMutation(({ id, fileId }: { id: string; fileId: string }) => removeSkillFile(id, fileId), "File removed", "Could not remove the file");
