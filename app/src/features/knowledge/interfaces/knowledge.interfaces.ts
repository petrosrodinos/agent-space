export const KnowledgeKinds = { FILE: "FILE", LINK: "LINK", TEXT: "TEXT" } as const;
export type KnowledgeKind = (typeof KnowledgeKinds)[keyof typeof KnowledgeKinds];
export const KnowledgeScopes = { BOT: "BOT", ORGANIZATION: "ORGANIZATION" } as const;
export type KnowledgeScope = (typeof KnowledgeScopes)[keyof typeof KnowledgeScopes];
/** Indexing state: the text is being read and embedded, is searchable, or could not be read. */
export const KnowledgeStatuses = { PROCESSING: "PROCESSING", READY: "READY", FAILED: "FAILED" } as const;
export type KnowledgeStatus = (typeof KnowledgeStatuses)[keyof typeof KnowledgeStatuses];

export interface KnowledgeItem {
  id: string;
  scope: KnowledgeScope;
  bot_id: string | null;
  kind: KnowledgeKind;
  title: string;
  url: string | null;
  file: { id: string; filename: string; mimetype: string; size: number } | null;
  preview: string | null;
  content?: string | null;
  characters: number;
  status: KnowledgeStatus;
  /** Why indexing failed (status FAILED). */
  status_error: string | null;
  readable: boolean;
  indexed_at: string | null;
  added_by: { id: string; name: string | null } | null;
  created_at: string;
}

export interface UpdateKnowledgeDto {
  title?: string;
  content?: string;
  url?: string;
}

export interface AddKnowledgeDto {
  kind: KnowledgeKind;
  title?: string;
  file_id?: string;
  url?: string;
  content?: string;
}
