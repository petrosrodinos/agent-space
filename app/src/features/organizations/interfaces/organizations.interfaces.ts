export const ModelPolicies = { ALL_MODELS: "ALL_MODELS", APPROVED_LIST: "APPROVED_LIST" } as const;
export type ModelPolicy = (typeof ModelPolicies)[keyof typeof ModelPolicies];
export const WhoCanValues = { EVERYONE: "EVERYONE", OWNERS_ADMINS: "OWNERS_ADMINS" } as const;
export type WhoCan = (typeof WhoCanValues)[keyof typeof WhoCanValues];

import type { OrgRole } from "@/features/users/interfaces/users.interfaces";

export interface OrganizationSettings {
  default_language: "EN" | "EL";
  default_timezone: string;
  invite_links_enabled: boolean;
  default_invite_role: OrgRole;
  auto_join_domain: string | null;
  invitation_expiry: "DAY_1" | "DAY_3" | "DAY_7" | "DAY_30";
  company_instructions: string | null;
  who_can_create_bots: WhoCan;
  max_bots_per_member: number | null;
  default_model_id: string | null;
  model_policy: ModelPolicy;
  model_auto_fallback: boolean;
  model_compare_enabled: boolean;
  members_api_key_connections: boolean;
  members_private_tool_servers?: boolean;
  builtin_web_search: boolean;
  builtin_document_creation: boolean;
  interactive_replies_mode: "BLOCKS_AND_MINI_APPS" | "BLOCKS_ONLY" | "OFF";
  min_approval_level: "NONE" | "IMPORTANT_ACTIONS" | "ALWAYS_ASK";
  enforced_approvals: string[];
  bots_consulting_enabled: boolean;
  approval_timeout_minutes: number | null;
  who_can_create_skills: WhoCan;
  starter_skills_enabled: boolean;
  conversation_retention: "FOREVER" | "YEAR_1" | "DAYS_90" | "DAYS_30";
  max_file_size: "MB_25" | "MB_50" | "MB_100";
  temporary_chats_allowed: boolean;
  members_may_export: boolean;
  require_two_factor: boolean;
  limit_reached_action: "PAUSE_AND_NOTIFY" | "SWITCH_TO_CHEAPER_MODEL" | "NOTIFY_ONLY";
  [key: string]: unknown;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
  logo_file_id: string | null;
  is_personal: boolean;
  created_at: string;
  settings: OrganizationSettings;
  subscription: { plan: string; status: string; seats: number } | null;
  allowed_model_ids: string[];
  my_role: OrgRole;
  _count: { members: number; bots: number };
}

export interface Member {
  id: string;
  role: OrgRole;
  joined_at: string;
  user: { id: string; email: string; name: string | null; avatar_file_id: string | null; job_title: string | null; last_active_at: string | null };
}

export interface Invitation {
  id: string;
  email: string | null;
  is_link: boolean;
  role: OrgRole;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: { id: string; name: string | null; email: string } | null;
}

export interface InvitationPreview {
  organization: { id: string; name: string; brand_color: string | null };
  role: OrgRole;
  email: string | null;
  is_link: boolean;
  invited_by: { name: string | null; email: string } | null;
  expires_at: string;
}

/** Per-email result of sending invitations. */
export const InviteResultStatuses = { INVITED: "invited", ALREADY_MEMBER: "already_member" } as const;
