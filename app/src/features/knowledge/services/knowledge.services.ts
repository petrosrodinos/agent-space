import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { AddKnowledgeDto, KnowledgeItem, UpdateKnowledgeDto } from "../interfaces/knowledge.interfaces";

/** botId = null → the organisation knowledge library. */
export const getKnowledge = (botId: string | null) => request<KnowledgeItem[]>(() => axiosInstance.get(botId ? ApiRoutes.knowledge.bot(botId) : ApiRoutes.knowledge.root));
export const addKnowledge = (botId: string | null, dto: AddKnowledgeDto) =>
  request<KnowledgeItem>(() => axiosInstance.post(botId ? ApiRoutes.knowledge.bot(botId) : ApiRoutes.knowledge.root, dto), "Could not add knowledge.");
export const getKnowledgeItem = (id: string) => request<KnowledgeItem>(() => axiosInstance.get(ApiRoutes.knowledge.one(id)));
export const updateKnowledge = (id: string, dto: UpdateKnowledgeDto) => request<KnowledgeItem>(() => axiosInstance.patch(ApiRoutes.knowledge.one(id), dto));
/** Reads the source again and re-indexes (retry after a failure). */
export const reindexKnowledge = (id: string) => request<KnowledgeItem>(() => axiosInstance.post(ApiRoutes.knowledge.reindex(id)), "Could not retry.");
export const deleteKnowledge = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(ApiRoutes.knowledge.one(id)));
