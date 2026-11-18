import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Message } from "../interfaces/conversations.interfaces";
import { QueryKeys } from "@/config/constants/query-keys";
import { MessagePartTypes, MessageStatuses } from "@/features/conversations/interfaces/conversations.interfaces";

export type MessagesPage = { data: Message[]; has_more: boolean };
export type MessagesCache = InfiniteData<MessagesPage, unknown>;

export const messagesKey = (conversationId: string) => [QueryKeys.MESSAGES, conversationId] as const;
export const runStatusKey = (conversationId: string) => [QueryKeys.RUN_STATUS, conversationId] as const;

/** Inserts or replaces a message in the cached pages (newest page is index 0, messages ascending inside a page). */
export function upsertMessage(qc: QueryClient, message: Message) {
  qc.setQueryData<MessagesCache>(messagesKey(message.conversation_id), (data) => {
    if (!data) return data;
    let found = false;
    const pages = data.pages.map((p) => {
      const idx = p.data.findIndex((m) => m.id === message.id);
      if (idx < 0) return p;
      found = true;
      const copy = [...p.data];
      copy[idx] = message;
      return { ...p, data: copy };
    });
    if (found) return { ...data, pages };
    // Replace an optimistic message carrying the same client id.
    const clientRef = message.parts?.find((p) => p.type === MessagePartTypes.CLIENT_REF) as { client_id: string } | undefined;
    const first = pages[0];
    let list = first.data;
    if (clientRef) list = list.filter((m) => m.id !== clientRef.client_id);
    list = [...list, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { ...data, pages: [{ ...first, data: list }, ...pages.slice(1)] };
  });
}

export function removeMessage(qc: QueryClient, conversationId: string, id: string) {
  qc.setQueryData<MessagesCache>(messagesKey(conversationId), (data) => (data ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.filter((m) => m.id !== id) })) } : data));
}

/** Streams a text delta into a message part (§7.3 live replies). */
export function applyDelta(qc: QueryClient, conversationId: string, messageId: string, index: number, delta: string) {
  qc.setQueryData<MessagesCache>(messagesKey(conversationId), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((p) => {
        const idx = p.data.findIndex((m) => m.id === messageId);
        if (idx < 0) return p;
        const m = p.data[idx];
        const parts = [...(m.parts ?? [])];
        while (parts.length <= index) parts.push({ type: MessagePartTypes.TEXT, text: "" });
        const part = parts[index];
        parts[index] = part.type === MessagePartTypes.TEXT ? { ...part, text: part.text + delta } : part;
        const copy = [...p.data];
        copy[idx] = { ...m, parts, status: MessageStatuses.STREAMING };
        return { ...p, data: copy };
      }),
    };
  });
}

export function allMessages(data: MessagesCache | undefined): Message[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((p) => p.data);
}
