import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { Artifact, ArtifactComment, ArtifactRecords, ArtifactSummary, ArtifactTab, ArtifactType, ArtifactVersion, PublicLinkDto, ShareArtifactDto, UpdateArtifactDto } from "../interfaces/artifacts.interfaces";

const R = ApiRoutes.artifacts;

export const getArtifacts = (params: { tab: ArtifactTab; search?: string; type?: ArtifactType; conversation_id?: string }) => request<ArtifactSummary[]>(() => axiosInstance.get(R.root, { params }));
export const getArtifact = (id: string) => request<Artifact>(() => axiosInstance.get(R.one(id)));
export const updateArtifact = (id: string, dto: UpdateArtifactDto) => request<Artifact>(() => axiosInstance.patch(R.one(id), dto));
export const deleteArtifact = (id: string) => request<{ ok: boolean; restorable_until: string }>(() => axiosInstance.delete(R.one(id)));
export const restoreArtifact = (id: string) => request<Artifact>(() => axiosInstance.post(R.restore(id)));
export const duplicateArtifact = (id: string) => request<Artifact>(() => axiosInstance.post(R.duplicate(id)));
export const shareArtifact = (id: string, dto: ShareArtifactDto) => request<Artifact>(() => axiosInstance.put(R.sharing(id), dto));
export const setPublicLink = (id: string, dto: PublicLinkDto) => request<Artifact>(() => axiosInstance.put(R.public_link(id), dto));
export const transferArtifact = (id: string, user_id: string) => request<Artifact>(() => axiosInstance.post(R.transfer(id), { user_id }));
export const getViewUrl = (id: string, version_id?: string) => request<{ url: string; expires_at: string }>(() => axiosInstance.post(R.view_token(id), { version_id }));
export const exportArtifact = (id: string) => request<{ filename: string; html: string }>(() => axiosInstance.get(R.export(id)));
export const getVersions = (id: string) => request<ArtifactVersion[]>(() => axiosInstance.get(R.versions(id)));
export const labelVersion = (id: string, versionId: string, label: string | null) => request<{ id: string; label: string | null }>(() => axiosInstance.patch(R.version(id, versionId), { label }));
export const restoreVersion = (id: string, versionId: string) => request<{ version: number }>(() => axiosInstance.post(R.version_restore(id, versionId)));
export const publishDraft = (id: string) => request<Artifact>(() => axiosInstance.post(R.publish(id)));
export const discardDraft = (id: string) => request<Artifact>(() => axiosInstance.delete(R.draft(id)));
export const getRecords = (id: string, collection?: string) => request<ArtifactRecords>(() => axiosInstance.get(R.records(id), { params: { collection } }));
export const deleteRecord = (id: string, recordId: string) => request<{ ok: boolean }>(() => axiosInstance.delete(R.record(id, recordId)));
export const getComments = (id: string) => request<ArtifactComment[]>(() => axiosInstance.get(R.comments(id)));
export const addComment = (id: string, dto: { content: string; parent_comment_id?: string; mentioned_bot_id?: string }) => request<{ id: string }>(() => axiosInstance.post(R.comments(id), dto));
export const resolveComment = (id: string, commentId: string, resolved: boolean) => request<{ id: string }>(() => axiosInstance.patch(R.comment(id, commentId), { resolved }));
export const deleteComment = (id: string, commentId: string) => request<{ ok: boolean }>(() => axiosInstance.delete(R.comment(id, commentId)));
