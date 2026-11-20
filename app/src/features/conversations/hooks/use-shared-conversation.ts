import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/config/constants/query-keys";
import { getSharedConversation } from "../services/conversations.services";
import { ConversationShareModes, type SharedMessage } from "../interfaces/conversations.interfaces";

/** How often a live link asks for new messages. */
const POLL_MS = 4000;
/** Each poll starts slightly before the last change so two edits in the same millisecond can't be missed (messages are merged by id). */
const CURSOR_OVERLAP_MS = 1000;

type Visible = Extract<SharedMessage, { deleted: false }>;

const byCreated = (a: Visible, b: Visible) => a.created_at.localeCompare(b.created_at);

/** Upserts changed messages by id, drops tombstones, keeps oldest first. */
function merge(current: Visible[], incoming: SharedMessage[]): Visible[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (m.deleted) map.delete(m.id);
    else map.set(m.id, m);
  }
  return [...map.values()].sort(byCreated);
}

/** The anonymous, read-only view of a shared conversation: first page, older pages on demand, and (live links only) polling for new messages. */
export function useSharedConversation(token: string) {
  const first = useQuery({
    queryKey: [QueryKeys.SHARED_CONVERSATION, token],
    queryFn: () => getSharedConversation(token),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const [messages, setMessages] = useState<Visible[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ended, setEnded] = useState(false);
  const cursor = useRef<string | null>(null);

  useEffect(() => {
    if (!first.data) return;
    setMessages(merge([], first.data.messages));
    setHasMore(first.data.has_more);
    cursor.current = first.data.cursor;
  }, [first.data]);

  const live = first.data?.mode === ConversationShareModes.LIVE;
  useEffect(() => {
    if (!live) return;
    const tick = async () => {
      if (document.hidden || !cursor.current) return;
      try {
        const since = new Date(new Date(cursor.current).getTime() - CURSOR_OVERLAP_MS).toISOString();
        const page = await getSharedConversation(token, { since });
        cursor.current = page.cursor;
        if (page.messages.length) setMessages((cur) => merge(cur, page.messages));
      } catch (e) {
        // The owner stopped sharing: say so instead of silently freezing.
        if (/available anymore/i.test((e as Error).message)) setEnded(true);
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, token]);

  const loadEarlier = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getSharedConversation(token, { before: oldest.created_at });
      setMessages((cur) => merge(cur, page.messages));
      setHasMore(page.has_more);
    } finally {
      setLoadingMore(false);
    }
  }, [messages, loadingMore, token]);

  return { page: first.data, isPending: first.isPending, error: first.error as Error | null, messages, hasMore, loadingMore, loadEarlier, ended, live };
}
