import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { ArtifactDataGrant, ArtifactExportFormat, Artifact, ArtifactComment, ArtifactRecords, ArtifactSummary, ArtifactTab, ArtifactType, ArtifactVersion, PublicLinkDto, ShareArtifactDto, UpdateArtifactDto } from "../interfaces/artifacts.interfaces";

const R = ApiRoutes.artifacts;

export const getArtifacts = (params: { tab: ArtifactTab; search?: string; type?: ArtifactType; conversation_id?: string }) => request<ArtifactSummary[]>(() => axiosInstance.get(R.root, { params }));
export const getArtifact = (id: string) => request<Artifact>(() => axiosInstance.get(R.one(id)));
export const updateArtifact = (id: string, dto: UpdateArtifactDto) => request<Artifact>(() => axiosInstance.patch(R.one(id), dto));
export const deleteArtifact = (id: string) => request<{ ok: boolean; restorable_until: string | null }>(() => axiosInstance.delete(R.one(id)));
export const restoreArtifact = (id: string) => request<Artifact>(() => axiosInstance.post(R.restore(id)));
export const duplicateArtifact = (id: string) => request<Artifact>(() => axiosInstance.post(R.duplicate(id)));
export const shareArtifact = (id: string, dto: ShareArtifactDto) => request<Artifact>(() => axiosInstance.put(R.sharing(id), dto));
export const setPublicLink = (id: string, dto: PublicLinkDto) => request<Artifact>(() => axiosInstance.put(R.public_link(id), dto));
export const transferArtifact = (id: string, user_id: string) => request<Artifact>(() => axiosInstance.post(R.transfer(id), { user_id }));
export const getViewUrl = (id: string, version_id?: string) => request<{ url: string; expires_at: string }>(() => axiosInstance.post(R.view_token(id), { version_id }));
export const getDataGrants = (id: string) => request<ArtifactDataGrant[]>(() => axiosInstance.get(R.data_grants(id)));
export const grantData = ({ id, service }: { id: string; service: string }) => request<ArtifactDataGrant[]>(() => axiosInstance.post(R.data_grants(id), { service }));
export const revokeData = ({ id, service }: { id: string; service: string }) => request<ArtifactDataGrant[]>(() => axiosInstance.delete(R.data_grant(id, service)));
export const getUploadUrl = (id: string, fileId: string) => request<{ url: string; filename: string }>(() => axiosInstance.get(R.upload_url(id, fileId)));
export const exportArtifact = (id: string) => request<{ filename: string; html: string }>(() => axiosInstance.get(R.export(id)));

/** Rendering a PDF, deck or document on the server can take a while. */
const EXPORT_TIMEOUT_MS = 180_000;

/** PDF, image, PowerPoint or Word file (§7.5), as a blob with the server's file name. */
export const exportArtifactFile = async (id: string, format: Exclude<ArtifactExportFormat, "html">): Promise<{ blob: Blob; filename: string }> => {
  try {
    const res = await axiosInstance.get<Blob>(R.export(id), { params: { format }, responseType: "blob", timeout: EXPORT_TIMEOUT_MS });
    const match = /filename="?([^";]+)"?/.exec(String(res.headers["content-disposition"] ?? ""));
    return { blob: res.data, filename: match?.[1] ?? `artifact.${format}` };
  } catch (error) {
    const data = (error as { response?: { data?: Blob } }).response?.data;
    const text = data instanceof Blob ? await data.text().catch(() => "") : "";
    let message = "";
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? "";
    } catch {
      message = "";
    }
    throw new Error(message || "Could not create the file. Please try again.");
  }
};
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
