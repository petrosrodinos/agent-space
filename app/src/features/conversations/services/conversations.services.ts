import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { Conversation, ConversationShare, ConversationShareMode, Message, SearchHit, SendMessageDto, SharedConversationPage } from "../interfaces/conversations.interfaces";
import { ConversationTypes } from "../interfaces/conversations.interfaces";

export const getConversations = (params: { archived?: boolean; search?: string } = {}) => request<Conversation[]>(() => axiosInstance.get(ApiRoutes.conversations.root, { params }));
export const getConversation = (id: string) => request<Conversation>(() => axiosInstance.get(ApiRoutes.conversations.one(id)));
export const openDirect = (dto: { bot_id: string; is_temporary?: boolean }) => request<Conversation>(() => axiosInstance.post(ApiRoutes.conversations.direct, dto));
export const createConversation = (dto: { type: typeof ConversationTypes.GROUP | typeof ConversationTypes.SHARED_BOT; name?: string; emoji?: string; color?: string; bot_ids: string[]; user_ids?: string[]; lead_bot_id?: string }) =>
  request<Conversation>(() => axiosInstance.post(ApiRoutes.conversations.root, dto));
export const updateConversation = (id: string, dto: { name?: string; emoji?: string; color?: string; lead_bot_id?: string | null }) => request<Conversation>(() => axiosInstance.patch(ApiRoutes.conversations.one(id), dto));
export const updateMyConversation = (id: string, dto: { is_favourite?: boolean; is_archived?: boolean; is_muted?: boolean; folder_id?: string | null }) =>
  request<{ ok: boolean }>(() => axiosInstance.patch(ApiRoutes.conversations.me(id), dto));
export const markRead = (id: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.conversations.read(id)));
export const deleteConversation = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.conversations.one(id)));
export const clearConversation = (id: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.conversations.clear(id)));
export const addParticipants = (id: string, dto: { user_ids?: string[]; bot_ids?: string[] }) => request<Conversation>(() => axiosInstance.post(ApiRoutes.conversations.participants(id), dto));
export const removeParticipant = (id: string, pid: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.conversations.participant(id, pid)));
export const getMessages = (id: string, before?: string) => request<{ data: Message[]; has_more: boolean }>(() => axiosInstance.get(ApiRoutes.conversations.messages(id), { params: { before, limit: 40 } }));
export const searchInConversation = (id: string, search: string) => request<{ data: Message[]; has_more: boolean }>(() => axiosInstance.get(ApiRoutes.conversations.messages(id), { params: { search, limit: 50 } }));
export const getPinned = (id: string) => request<Message[]>(() => axiosInstance.get(ApiRoutes.conversations.pinned(id)));
export const sendMessage = (id: string, dto: SendMessageDto) => request<{ message: Message; runs: { id: string; bot_id: string; status: string }[]; secret_masked: boolean }>(() => axiosInstance.post(ApiRoutes.conversations.messages(id), dto));
export const editMessage = (id: string, dto: { content: string; rerun?: boolean }) => request<Message>(() => axiosInstance.patch(ApiRoutes.messages.one(id), dto));
export const deleteMessage = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.messages.one(id)));
export const retryMessage = (id: string, dto: { model_id?: string; branch?: boolean }) => request<{ run: { id: string } }>(() => axiosInstance.post(ApiRoutes.messages.retry(id), dto));
export const reactToMessage = (id: string, emoji: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.messages.reactions(id), { emoji }));
export const togglePin = (id: string) => request<{ ok: boolean; is_pinned: boolean }>(() => axiosInstance.post(ApiRoutes.messages.pin(id)));
export const interact = (id: string, dto: { component_id: string; payload: Record<string, unknown> }) => request<{ ok: boolean; total_responses: number }>(() => axiosInstance.post(ApiRoutes.messages.interactions(id), dto));
export const searchMessages = (q: string) => request<SearchHit[]>(() => axiosInstance.get(ApiRoutes.messages.search, { params: { q } }));
export const stopRun = (id: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.runs.stop(id)));

export const getConversationShare = (id: string) => request<{ share: ConversationShare | null }>(() => axiosInstance.get(ApiRoutes.conversations.share(id)));
export const saveConversationShare = (id: string, dto: { mode: ConversationShareMode; refresh?: boolean }) => request<{ share: ConversationShare }>(() => axiosInstance.put(ApiRoutes.conversations.share(id), dto));
export const stopConversationShare = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.conversations.share(id)));
export const getSharedConversation = (token: string, params: { before?: string; since?: string } = {}) =>
  request<SharedConversationPage>(() => axiosInstance.get(ApiRoutes.shared_conversations.one(token), { params }));
