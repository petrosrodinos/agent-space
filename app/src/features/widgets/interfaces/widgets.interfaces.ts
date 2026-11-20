import type { UiBlock } from "@/features/conversations/interfaces/conversations.interfaces";

/** A saved widget (§7.4): an interactive reply kept for reuse and rebuilt with fresh data when opened. */
export interface Widget {
  id: string;
  title: string;
  refresh_prompt: string | null;
  conversation_id: string | null;
  source_message_id: string | null;
  bot: { id: string; name: string; emoji: string; color: string } | null;
  blocks: UiBlock[];
  fallback_text: string;
  refreshed_at: string;
  refresh_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWidgetDto {
  message_id: string;
  ui_id: string;
  title?: string;
}

export interface UpdateWidgetDto {
  title?: string;
  refresh_prompt?: string;
}
