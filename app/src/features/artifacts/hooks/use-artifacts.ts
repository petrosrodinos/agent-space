import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { ArtifactTab, ArtifactType, PublicLinkDto, ShareArtifactDto, UpdateArtifactDto } from "../interfaces/artifacts.interfaces";
import {
  addComment,
  deleteArtifact,
  deleteComment,
  deleteRecord,
  discardDraft,
  duplicateArtifact,
  getArtifact,
  getArtifacts,
  getComments,
  getDataGrants,
  grantData,
  revokeData,
  getRecords,
  getVersions,
  getViewUrl,
  labelVersion,
  publishDraft,
  resolveComment,
  restoreArtifact,
  restoreVersion,
  setPublicLink,
  shareArtifact,
  transferArtifact,
  updateArtifact,
} from "../services/artifacts.services";
import { QueryKeys } from "@/config/constants/query-keys";

export const useArtifacts = (tab: ArtifactTab, search?: string, type?: ArtifactType) => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.ARTIFACTS, tab, search ?? "", type ?? ""], queryFn: () => getArtifacts({ tab, search, type }), enabled: !!org });
};
export const useArtifact = (id: string) => useQuery({ queryKey: [QueryKeys.ARTIFACT, id], queryFn: () => getArtifact(id), enabled: !!id });
export const useArtifactVersions = (id: string, enabled = true) => useQuery({ queryKey: [QueryKeys.ARTIFACT, id, "versions"], queryFn: () => getVersions(id), enabled: !!id && enabled });
export const useArtifactRecords = (id: string, collection?: string, enabled = true) => useQuery({ queryKey: [QueryKeys.ARTIFACT, id, "records", collection ?? ""], queryFn: () => getRecords(id, collection), enabled: !!id && enabled });
export const useArtifactComments = (id: string, enabled = true) => useQuery({ queryKey: [QueryKeys.ARTIFACT, id, "comments"], queryFn: () => getComments(id), enabled: !!id && enabled });

/**
 * Signed address for the sandboxed preview. Tokens last 15 minutes; refetching every 10 keeps reloads working
 * without re-rendering the iframe unless the content (`rev`) changes.
 */
export const useArtifactViewUrl = (id: string, versionId?: string, rev?: string | number) =>
  useQuery({ queryKey: [QueryKeys.ARTIFACT, id, "view", versionId ?? "current", rev ?? ""], queryFn: () => getViewUrl(id, versionId), enabled: !!id, staleTime: 10 * 60_000, refetchOnWindowFocus: false });

const useArtifactMutation = <T, R = unknown>(fn: (v: T) => Promise<R>, success: string | null, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.ARTIFACTS] });
      qc.invalidateQueries({ queryKey: [QueryKeys.ARTIFACT] });
      if (success) toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useUpdateArtifact = (success: string | null = "Saved") => useArtifactMutation(({ id, ...dto }: { id: string } & UpdateArtifactDto) => updateArtifact(id, dto), success, "Could not save");
export const useArtifactDataGrants = (id: string) => useQuery({ queryKey: [QueryKeys.ARTIFACT, id, "data-grants"], queryFn: () => getDataGrants(id), enabled: !!id });
export const useGrantArtifactData = () => useArtifactMutation(grantData, "Access allowed", "Could not allow access");
export const useRevokeArtifactData = () => useArtifactMutation(revokeData, "Access removed", "Could not remove access");
export const useDeleteArtifact = () => useArtifactMutation(deleteArtifact, "Artifact deleted — you can restore it from the Deleted tab", "Could not delete");
export const useRestoreArtifact = () => useArtifactMutation(restoreArtifact, "Artifact restored", "Could not restore");
export const useDuplicateArtifact = () => useArtifactMutation(duplicateArtifact, "Copy created — it's yours to change", "Could not duplicate");
export const useShareArtifact = () => useArtifactMutation(({ id, ...dto }: { id: string } & ShareArtifactDto) => shareArtifact(id, dto), "Sharing updated", "Could not update sharing");
export const useSetPublicLink = () => useArtifactMutation(({ id, ...dto }: { id: string } & PublicLinkDto) => setPublicLink(id, dto), "Public link updated", "Could not update the public link");
export const useTransferArtifact = () => useArtifactMutation(({ id, user_id }: { id: string; user_id: string }) => transferArtifact(id, user_id), "Ownership transferred", "Could not transfer");
export const useLabelVersion = () => useArtifactMutation(({ id, versionId, label }: { id: string; versionId: string; label: string | null }) => labelVersion(id, versionId, label), "Version named", "Could not name the version");
export const useRestoreVersion = () => useArtifactMutation(({ id, versionId }: { id: string; versionId: string }) => restoreVersion(id, versionId), "Version restored as a new version", "Could not restore");
export const usePublishDraft = () => useArtifactMutation(publishDraft, "Draft published", "Could not publish");
export const useDiscardDraft = () => useArtifactMutation(discardDraft, "Draft discarded", "Could not discard");
export const useDeleteRecord = () => useArtifactMutation(({ id, recordId }: { id: string; recordId: string }) => deleteRecord(id, recordId), "Entry deleted", "Could not delete");
export const useAddComment = () => useArtifactMutation(({ id, ...dto }: { id: string; content: string; parent_comment_id?: string; mentioned_bot_id?: string }) => addComment(id, dto), null, "Could not comment");
export const useResolveComment = () => useArtifactMutation(({ id, commentId, resolved }: { id: string; commentId: string; resolved: boolean }) => resolveComment(id, commentId, resolved), null, "Could not update");
export const useDeleteComment = () => useArtifactMutation(({ id, commentId }: { id: string; commentId: string }) => deleteComment(id, commentId), "Comment deleted", "Could not delete");
