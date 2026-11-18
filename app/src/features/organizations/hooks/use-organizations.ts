import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import type { OrgRole } from "@/features/users/interfaces/users.interfaces";
import {
  acceptInvitation, cancelInvitation, createInviteLink, createOrganization, deleteOrganization, getCurrentOrganization, inviteMembers, leaveOrganization,
  listInvitations, listMembers, previewInvitation, removeMember, resendInvitation, transferOwnership, updateMemberRole, updateOrganization, updateOrganizationSettings,
} from "../services/organizations.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { InviteResultStatuses } from "../interfaces/organizations.interfaces";

export const useCurrentOrganization = () => {
  const orgId = useOrganizationStore((s) => s.current_id);
  return useQuery({ queryKey: [QueryKeys.ORGANIZATION, orgId], queryFn: getCurrentOrganization, enabled: !!orgId, staleTime: 60_000 });
};

/** Switching organisations clears every org-scoped cache (§5.1: everything belongs to the selected org). */
export const useSwitchOrganization = () => {
  const qc = useQueryClient();
  const setCurrent = useOrganizationStore((s) => s.setCurrent);
  return (id: string) => {
    setCurrent(id);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== QueryKeys.ME });
    qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
  };
};

export const useCreateOrganization = () => {
  const qc = useQueryClient();
  const switchOrg = useSwitchOrganization();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
      switchOrg(org.id);
      toast({ title: `${org.name} created` });
    },
    onError: (e) => toast({ title: "Could not create the organisation", description: e.message, variant: "error" }),
  });
};

const useOrgMutation = <T,>(fn: (v: T) => Promise<unknown>, success: string, fail: string, keys: string[][] = [[QueryKeys.ORGANIZATION]]) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useUpdateOrganization = () => useOrgMutation(updateOrganization, "Organisation saved", "Could not save", [[QueryKeys.ORGANIZATION], [QueryKeys.ME]]);
export const useUpdateOrganizationSettings = () => useOrgMutation(updateOrganizationSettings, "Settings saved", "Could not save settings", [[QueryKeys.ORGANIZATION], [QueryKeys.MODELS]]);
export const useMembers = () => useQuery({ queryKey: [QueryKeys.MEMBERS], queryFn: listMembers });
export const useInvitations = (enabled = true) => useQuery({ queryKey: [QueryKeys.INVITATIONS], queryFn: listInvitations, enabled });
export const useUpdateMemberRole = () => useOrgMutation(({ userId, role }: { userId: string; role: OrgRole }) => updateMemberRole(userId, role), "Role updated", "Could not change the role", [[QueryKeys.MEMBERS]]);
export const useRemoveMember = () => useOrgMutation(removeMember, "Member removed", "Could not remove the member", [[QueryKeys.MEMBERS]]);
export const useInviteMembers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteMembers,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.INVITATIONS] });
      const invited = res.results.filter((r) => r.status === InviteResultStatuses.INVITED).length;
      const already = res.results.filter((r) => r.status === InviteResultStatuses.ALREADY_MEMBER).length;
      toast({ title: invited ? `Invitation${invited > 1 ? "s" : ""} sent` : "Nobody new to invite", description: already ? `${already} already in the organisation` : undefined });
    },
    onError: (e) => toast({ title: "Could not send invitations", description: e.message, variant: "error" }),
  });
};
export const useCreateInviteLink = () => useMutation({ mutationFn: createInviteLink, onError: (e) => toast({ title: "Could not create a link", description: e.message, variant: "error" }), onSuccess: () => toast({ title: "Invite link created" }) });
export const useCancelInvitation = () => useOrgMutation(cancelInvitation, "Invitation cancelled", "Could not cancel", [[QueryKeys.INVITATIONS]]);
export const useResendInvitation = () => useOrgMutation(resendInvitation, "Invitation re-sent", "Could not re-send", [[QueryKeys.INVITATIONS]]);
export const useTransferOwnership = () => useOrgMutation(transferOwnership, "Ownership transferred", "Could not transfer ownership", [[QueryKeys.MEMBERS], [QueryKeys.ORGANIZATION], [QueryKeys.ME]]);
export const useLeaveOrganization = () => useOrgMutation(leaveOrganization, "You left the organisation", "Could not leave", [[QueryKeys.ME]]);
export const useDeleteOrganization = () => useOrgMutation(deleteOrganization, "Organisation deleted", "Could not delete", [[QueryKeys.ME]]);
export const useInvitationPreview = (token: string) => useQuery({ queryKey: [QueryKeys.INVITATION, token], queryFn: () => previewInvitation(token), enabled: !!token, retry: false });
export const useAcceptInvitation = () => {
  const qc = useQueryClient();
  const setCurrent = useOrganizationStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (res) => {
      setCurrent(res.organization_id);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== QueryKeys.ME });
      qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
      toast({ title: res.already_member ? "You're already a member" : "Welcome aboard" });
    },
    onError: (e) => toast({ title: "Could not accept the invitation", description: e.message, variant: "error" }),
  });
};
