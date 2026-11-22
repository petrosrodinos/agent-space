export const ArtifactTypes = { WEB_APP: "WEB_APP", DASHBOARD: "DASHBOARD", PAGE: "PAGE", DOCUMENT: "DOCUMENT", PRESENTATION: "PRESENTATION", DIAGRAM: "DIAGRAM", FORM: "FORM", TOOL: "TOOL", GAME: "GAME", OTHER: "OTHER" } as const;
export type ArtifactType = (typeof ArtifactTypes)[keyof typeof ArtifactTypes];
export const ArtifactExportFormats = { HTML: "html", PDF: "pdf", PNG: "png", PPTX: "pptx", DOCX: "docx" } as const;
export type ArtifactExportFormat = (typeof ArtifactExportFormats)[keyof typeof ArtifactExportFormats];
export const ArtifactRoles = { OWNER: "OWNER", EDITOR: "EDITOR", COMMENTER: "COMMENTER", VIEWER: "VIEWER" } as const;
export type ArtifactRole = (typeof ArtifactRoles)[keyof typeof ArtifactRoles];
export const ArtifactSharingLevels = { PRIVATE: "PRIVATE", SPECIFIC_MEMBERS: "SPECIFIC_MEMBERS", ORGANIZATION: "ORGANIZATION", PUBLIC_LINK: "PUBLIC_LINK" } as const;
export type ArtifactSharing = (typeof ArtifactSharingLevels)[keyof typeof ArtifactSharingLevels];
export const ArtifactTabs = { ALL: "all", MINE: "mine", SHARED: "shared", ORGANIZATION: "organization", DELETED: "deleted" } as const;
export type ArtifactTab = (typeof ArtifactTabs)[keyof typeof ArtifactTabs];
export const ArtifactVersionStatuses = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED" } as const;
export type ArtifactVersionStatus = (typeof ArtifactVersionStatuses)[keyof typeof ArtifactVersionStatuses];

export interface PersonBrief {
  id: string;
  name: string | null;
  email: string;
}

export interface ArtifactSummary {
  id: string;
  title: string;
  slug: string;
  type: ArtifactType;
  description: string | null;
  sharing_level: ArtifactSharing;
  public_enabled: boolean;
  owner: PersonBrief | null;
  role: ArtifactRole;
  pinned: boolean;
  version: number | null;
  has_draft: boolean;
  conversation_id: string | null;
  view_count?: number;
  taken_down: boolean;
  deleted_at: string | null;
  updated_at: string;
  created_at: string;
  url: string;
}

export interface ArtifactVersionBrief {
  id: string;
  version: number;
  change_summary: string | null;
  published_at?: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  title: string;
  slug: string;
  type: ArtifactType;
  description: string | null;
  role: ArtifactRole;
  owner: PersonBrief | null;
  sharing_level: ArtifactSharing;
  organization_role: Exclude<ArtifactRole, "OWNER">;
  shares: { user: PersonBrief; role: Exclude<ArtifactRole, "OWNER"> }[];
  public_link: { enabled: boolean; has_password: boolean; expires_at: string | null; allow_search_engines: boolean; allow_embedding: boolean; public_ai_enabled: boolean; public_uploads_enabled: boolean };
  review_before_publish: boolean;
  current_version: ArtifactVersionBrief | null;
  draft_version: ArtifactVersionBrief | null;
  version_count: number;
  pinned: boolean;
  stats: { views: number; uses: number; records: number } | null;
  open_comments: number;
  conversation: { id: string; name: string } | null;
  duplicated_from_id: string | null;
  brand_color: string | null;
  url: string;
  embed_code: string | null;
  taken_down: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  id: string;
  version: number;
  status: ArtifactVersionStatus;
  label: string | null;
  change_summary: string | null;
  restored_from_version: number | null;
  published_at: string | null;
  created_at: string;
  created_by: PersonBrief | null;
  bot: { id: string; name: string; avatar_seed: string; color: string } | null;
  is_current: boolean;
  is_draft: boolean;
}

/** A member allowed this artifact to read one of their connected services (§7.5 Show live data). */
export interface ArtifactDataGrant {
  service: string;
  service_name: string;
  created_at: string;
}

/** A visitor upload saved in a record by `agentspace.upload` (§7.5). */
export interface ArtifactFileRef {
  type: "file";
  id: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface ArtifactUpload {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  created_at: string;
  is_visitor: boolean;
}

export interface ArtifactRecords {
  collections: { name: string; count: number }[];
  files: ArtifactUpload[];
  records: { id: string; collection: string; data: Record<string, unknown>; submitted_by: PersonBrief | null; is_visitor: boolean; created_at: string }[];
}

export interface ArtifactCommentItem {
  id: string;
  content: string;
  anchor: Record<string, unknown> | null;
  author: PersonBrief | null;
  mentioned_bot: { id: string; name: string; avatar_seed: string; color: string } | null;
  resolved_at: string | null;
  created_at: string;
  is_mine: boolean;
}

export interface ArtifactComment extends ArtifactCommentItem {
  replies: ArtifactCommentItem[];
}

export interface ShareArtifactDto {
  sharing_level: ArtifactSharing;
  shares?: { user_id: string; role: Exclude<ArtifactRole, "OWNER"> }[];
  organization_role?: Exclude<ArtifactRole, "OWNER">;
}

export interface PublicLinkDto {
  enabled: boolean;
  password?: string;
  expires_at?: string | null;
  allow_search_engines?: boolean;
  allow_embedding?: boolean;
  public_ai_enabled?: boolean;
  public_uploads_enabled?: boolean;
}

export interface UpdateArtifactDto {
  title?: string;
  description?: string;
  type?: ArtifactType;
  slug?: string;
  review_before_publish?: boolean;
  pinned?: boolean;
}
