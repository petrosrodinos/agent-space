import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";

export const SkillTabs = { ALL: "all", MINE: "mine", SHARED: "shared", ORGANIZATION: "organization", STARTER: "starter", DELETED: "deleted" } as const;
export type SkillTab = (typeof SkillTabs)[keyof typeof SkillTabs];
export const SkillSharingLevels = { PRIVATE: "PRIVATE", SPECIFIC_MEMBERS: "SPECIFIC_MEMBERS", ORGANIZATION: "ORGANIZATION" } as const;
export type SkillSharing = (typeof SkillSharingLevels)[keyof typeof SkillSharingLevels];
export const SkillRoles = { OWNER: "OWNER", EDITOR: "EDITOR", USER: "USER" } as const;
export type SkillRole = (typeof SkillRoles)[keyof typeof SkillRoles];
/** Roles that can be given when sharing a skill (one Owner). */
export type SkillShareRole = typeof SkillRoles.EDITOR | typeof SkillRoles.USER;
/** Route id used by the "new skill" page (Routes.skills.new). */
export const NEW_SKILL_ID = "new";

export interface SkillQuestion {
  key: string;
  question: string;
  required?: boolean;
}

export interface SkillSummary {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
  description: string;
  sharing_level: SkillSharing;
  is_starter: boolean;
  owner: { id: string; name: string | null } | null;
  current_version: number;
  updated_at: string;
  deleted_at: string | null;
  bots: BotBrief[];
  my_role: SkillRole | null;
}

export interface SkillVersion {
  id: string;
  version: number;
  name: string;
  emoji: string | null;
  description: string;
  instructions: string;
  change_summary: string | null;
  restored_from_version: number | null;
  created_at: string;
  created_by: { id: string; name: string | null } | null;
}

export interface Skill extends SkillSummary {
  instructions: string;
  questions: SkillQuestion[];
  required_tools: { service_key: string }[];
  result: string | null;
  shares: { id: string; user_id: string; role: SkillRole; user: { id: string; name: string | null; email: string } }[];
  versions: SkillVersion[];
  files?: { id: string; filename: string; mimetype: string; size: number; created_at: string }[];
}

export interface SkillFormDto {
  name: string;
  emoji?: string;
  slug?: string;
  description: string;
  instructions: string;
  questions?: SkillQuestion[];
  required_services?: string[];
  result?: string;
  change_summary?: string;
}
