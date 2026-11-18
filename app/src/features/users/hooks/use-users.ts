import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, AuthStatuses } from "@/stores/auth";
import { getOrganizationStoreState } from "@/stores/organization";
import type { ColorTheme, MeResponse, UserSettings } from "../interfaces/users.interfaces";
import { deleteAccount, getDevices, getMe, getSessions, renameDevice, revokeOtherSessions, revokeSession, signOutDevice, updateColorTheme, updateProfile, updateSettings } from "../services/users.services";
import { QueryKeys } from "@/config/constants/query-keys";

export const useMe = () => {
  const signedIn = useAuthStore((s) => s.status === AuthStatuses.SIGNED_IN);
  return useQuery({ queryKey: [QueryKeys.ME], queryFn: getMe, enabled: signedIn, staleTime: 60_000 });
};

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
      toast({ title: "Profile saved", duration: 1500 });
    },
    onError: (e) => toast({ title: "Could not save your profile", description: e.message, variant: "error" }),
  });
};

/** Optimistic: settings toggles feel instant. */
export const useUpdateSettings = (opts: { silent?: boolean } = {}) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onMutate: async (dto: Partial<UserSettings>) => {
      await qc.cancelQueries({ queryKey: [QueryKeys.ME] });
      const prev = qc.getQueryData<MeResponse>([QueryKeys.ME]);
      if (prev) qc.setQueryData<MeResponse>([QueryKeys.ME], { ...prev, settings: { ...prev.settings, ...dto } });
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
      if (!opts.silent) toast({ title: "Saved", duration: 1200 });
    },
    onError: (e, _dto, ctx) => {
      if (ctx?.prev) qc.setQueryData([QueryKeys.ME], ctx.prev);
      toast({ title: "Could not save the setting", description: e.message, variant: "error" });
    },
  });
};

/** Optimistic: the colour theme of the selected organisation switches instantly. */
export const useUpdateColorTheme = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateColorTheme,
    onMutate: async (color_theme: ColorTheme) => {
      await qc.cancelQueries({ queryKey: [QueryKeys.ME] });
      const prev = qc.getQueryData<MeResponse>([QueryKeys.ME]);
      const orgId = getOrganizationStoreState().current_id;
      if (prev)
        qc.setQueryData<MeResponse>([QueryKeys.ME], {
          ...prev,
          organizations: prev.organizations.map((o) => (o.id === orgId ? { ...o, color_theme } : o)),
        });
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.ME] });
      toast({ title: "Theme saved", duration: 1200 });
    },
    onError: (e, _dto, ctx) => {
      if (ctx?.prev) qc.setQueryData([QueryKeys.ME], ctx.prev);
      toast({ title: "Could not save the theme", description: e.message, variant: "error" });
    },
  });
};

export const useDeleteAccount = () =>
  useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => toast({ title: "Your account was deleted" }),
    onError: (e) => toast({ title: "Could not delete your account", description: e.message, variant: "error" }),
  });

export const useDevices = () => useQuery({ queryKey: [QueryKeys.DEVICES], queryFn: getDevices });
export const useSessions = () => useQuery({ queryKey: [QueryKeys.SESSIONS], queryFn: getSessions });

export const useRenameDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDevice(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.DEVICES] });
      toast({ title: "Device renamed" });
    },
    onError: (e) => toast({ title: "Could not rename", description: e.message, variant: "error" }),
  });
};

export const useSignOutDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signOutDevice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.DEVICES] });
      qc.invalidateQueries({ queryKey: [QueryKeys.SESSIONS] });
      toast({ title: "Signed out of that device" });
    },
    onError: (e) => toast({ title: "Could not sign out", description: e.message, variant: "error" }),
  });
};

export const useRevokeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.SESSIONS] });
      toast({ title: "Session signed out" });
    },
    onError: (e) => toast({ title: "Could not sign out", description: e.message, variant: "error" }),
  });
};

export const useRevokeOtherSessions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.SESSIONS] });
      toast({ title: "Signed out everywhere else" });
    },
    onError: (e) => toast({ title: "Could not sign out", description: e.message, variant: "error" }),
  });
};
