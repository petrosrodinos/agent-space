import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import { useAuthStore } from "@/stores/auth";
import type { Message, SendMessageDto } from "../interfaces/conversations.interfaces";
import { allMessages, messagesKey, removeMessage, replyPreviewOf, upsertMessage, type MessagesCache } from "../utils/messages-cache";
import {
  addParticipants, clearConversation, createConversation, deleteConversation, deleteMessage, editMessage, getConversation, getConversationShare, getConversations, getMessages, getPinned, interact, markRead,
  openDirect, reactToMessage, removeParticipant, retryMessage, saveConversationShare, searchInConversation, searchMessages, sendMessage, stopConversationShare, stopRun, togglePin, updateConversation, updateMyConversation,
} from "../services/conversations.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { MessageStatuses, MessagePartTypes, MessageAuthorTypes, MessageSources } from "../interfaces/conversations.interfaces";

export const useConversations = (archived = false) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.CONVERSATIONS, { archived }], queryFn: () => getConversations({ archived }), enabled: !!org });
};

export const useConversation = (id: string | undefined) => useQuery({ queryKey: [QueryKeys.CONVERSATION, id], queryFn: () => getConversation(id!), enabled: !!id, retry: false });

export const useMessages = (conversationId: string | undefined) =>
  useInfiniteQuery({
    queryKey: messagesKey(conversationId ?? ""),
    queryFn: ({ pageParam }) => getMessages(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.has_more && last.data.length ? last.data[0].created_at : undefined),
    enabled: !!conversationId,
    staleTime: 30_000,
  });

export const usePinned = (id: string, enabled: boolean) => useQuery({ queryKey: [QueryKeys.PINNED, id], queryFn: () => getPinned(id), enabled });
export const useConversationSearch = (id: string, q: string) => useQuery({ queryKey: [QueryKeys.CONVERSATION_SEARCH, id, q], queryFn: () => searchInConversation(id, q), enabled: q.trim().length > 1 });
export const useGlobalSearch = (q: string) => useQuery({ queryKey: [QueryKeys.SEARCH, q], queryFn: () => searchMessages(q), enabled: q.trim().length > 1 });

export const useOpenDirect = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: openDirect,
    onSuccess: (c) => {
      qc.setQueryData([QueryKeys.CONVERSATION, c.id], c);
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
    },
    onError: (e) => toast({ title: "Could not open the chat", description: e.message, variant: "error" }),
  });
};

export const useCreateConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createConversation,
    onSuccess: (c) => {
      qc.setQueryData([QueryKeys.CONVERSATION, c.id], c);
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      toast({ title: `${c.name} is ready` });
    },
    onError: (e) => toast({ title: "Could not create the group", description: e.message, variant: "error" }),
  });
};

const useConvMutation = <T,>(fn: (v: T) => Promise<unknown>, success?: string, fail = "Something went wrong") => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATION] });
      if (success) toast({ title: success, duration: 1500 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useUpdateConversation = () => useConvMutation(({ id, ...dto }: { id: string; name?: string; color?: string; lead_bot_id?: string | null }) => updateConversation(id, dto), "Saved", "Could not save");
export const useUpdateMyConversation = () => useConvMutation(({ id, ...dto }: { id: string; is_favourite?: boolean; is_archived?: boolean; is_muted?: boolean; folder_id?: string | null }) => updateMyConversation(id, dto));
export const useDeleteConversation = () => useConvMutation(deleteConversation, "Conversation deleted", "Could not delete");
export const useClearConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearConversation,
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: [QueryKeys.MESSAGES, id] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATION, id] });
      toast({ title: "Conversation cleared", duration: 1500 });
    },
    onError: (e: Error) => toast({ title: "Could not clear the conversation", description: e.message, variant: "error" }),
  });
};
export const useAddParticipants = () => useConvMutation(({ id, ...dto }: { id: string; user_ids?: string[]; bot_ids?: string[] }) => addParticipants(id, dto), "Added", "Could not add");
export const useRemoveParticipant = () => useConvMutation(({ id, pid }: { id: string; pid: string }) => removeParticipant(id, pid), "Removed", "Could not remove");

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: markRead, onSuccess: () => qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] }) });
};

/** Optimistic send: the message shows immediately, then is replaced by the server copy (matched by client id). */
export const useSendMessage = (conversationId: string) => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (dto: SendMessageDto) => sendMessage(conversationId, dto),
    onMutate: (dto) => {
      const client_id = dto.client_id ?? crypto.randomUUID();
      dto.client_id = client_id;
      const optimistic: Message = {
        id: client_id,
        conversation_id: conversationId,
        author_type: MessageAuthorTypes.USER,
        author_user: user ? { id: user.id, name: user.name, email: user.email } : null,
        author_bot: null,
        source: MessageSources.TEXT,
        status: MessageStatuses.COMPLETED,
        content: dto.content,
        parts: [{ type: MessagePartTypes.TEXT, text: dto.content }],
        run: null,
        run_id: null,
        parent_message_id: dto.parent_message_id ?? null,
        reply_to_message_id: dto.reply_to_message_id ?? null,
        reply_to: dto.reply_to_message_id ? replyPreviewOf(allMessages(qc.getQueryData<MessagesCache>(messagesKey(conversationId))).find((x) => x.id === dto.reply_to_message_id)) : null,
        branch_from_message_id: null,
        branch_index: 0,
        model_id: null,
        is_pinned: false,
        edited_at: null,
        secret_masked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reply_count: 0,
        reactions: [],
        files: [],
        pending: true,
      };
      qc.setQueryData<MessagesCache>(messagesKey(conversationId), (data) =>
        data ? { ...data, pages: [{ ...data.pages[0], data: [...data.pages[0].data, optimistic] }, ...data.pages.slice(1)] } : data,
      );
      return { client_id };
    },
    onSuccess: (res) => {
      upsertMessage(qc, res.message);
      if (res.secret_masked) toast({ title: "Secret not shared", description: "Something that looked like a key was masked and wasn't shared with the bot. Use the secure secret box instead." });
      qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
    },
    onError: (e, _dto, ctx) => {
      if (ctx) removeMessage(qc, conversationId, ctx.client_id);
      toast({ title: "Message not sent", description: e.message, variant: "error" });
    },
  });
};

export const useEditMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; content: string; rerun?: boolean }) => editMessage(id, dto),
    onSuccess: (m) => upsertMessage(qc, m),
    onError: (e) => toast({ title: "Could not edit", description: e.message, variant: "error" }),
  });
};

export const useDeleteMessage = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMessage,
    onSuccess: (_r, id) => removeMessage(qc, conversationId, id),
    onError: (e) => toast({ title: "Could not delete", description: e.message, variant: "error" }),
  });
};

export const useRetryMessage = () => useMutation({ mutationFn: ({ id, ...dto }: { id: string; model_id?: string; branch?: boolean }) => retryMessage(id, dto), onError: (e) => toast({ title: "Could not retry", description: e.message, variant: "error" }) });
export const useReact = () => useMutation({ mutationFn: ({ id, emoji }: { id: string; emoji: string }) => reactToMessage(id, emoji), onError: (e) => toast({ title: "Could not react", description: e.message, variant: "error" }) });
export const useTogglePin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: togglePin,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.PINNED] });
      toast({ title: r.is_pinned ? "Pinned" : "Unpinned", duration: 1200 });
    },
    onError: (e) => toast({ title: "Could not pin", description: e.message, variant: "error" }),
  });
};
export const useInteract = () => useMutation({ mutationFn: ({ id, ...dto }: { id: string; component_id: string; payload: Record<string, unknown> }) => interact(id, dto), onError: (e) => toast({ title: "Could not submit", description: e.message, variant: "error" }) });
export const useStopRun = () => useMutation({ mutationFn: stopRun, onError: (e) => toast({ title: "Could not stop", description: e.message, variant: "error" }) });

/** The conversation's public link (null when it isn't shared). Only fetched while the share dialog is open. */
export const useConversationShare = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: [QueryKeys.CONVERSATION_SHARE, id], queryFn: async () => (await getConversationShare(id!)).share, enabled: !!id && enabled, staleTime: 0 });

export const useSaveConversationShare = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Parameters<typeof saveConversationShare>[1]) => saveConversationShare(id, dto),
    onSuccess: ({ share }) => qc.setQueryData([QueryKeys.CONVERSATION_SHARE, id], share),
    onError: (e: Error) => toast({ title: "Could not update the link", description: e.message, variant: "error" }),
  });
};

export const useStopConversationShare = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => stopConversationShare(id),
    onSuccess: () => {
      qc.setQueryData([QueryKeys.CONVERSATION_SHARE, id], null);
      toast({ title: "Sharing stopped", description: "The link no longer works.", duration: 2000 });
    },
    onError: (e: Error) => toast({ title: "Could not stop sharing", description: e.message, variant: "error" }),
  });
};
