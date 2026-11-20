import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, AuthStatuses } from "@/stores/auth";
import { platform } from "@/platform";
import { deletePushSubscription, getNotificationPreferences, getNotifications, getPushConfig, markAllNotificationsRead, markNotificationRead, savePushSubscription, updateNotificationPreference } from "../services/notifications.services";
import { QueryKeys } from "@/config/constants/query-keys";

export const useNotifications = () => {
  const signedIn = useAuthStore((s) => s.status === AuthStatuses.SIGNED_IN);
  return useQuery({ queryKey: [QueryKeys.NOTIFICATIONS], queryFn: () => getNotifications(), enabled: signedIn });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: markNotificationRead, onSuccess: () => qc.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATIONS] }) });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => qc.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATIONS] }) });
};

export const useNotificationPreferences = () => useQuery({ queryKey: [QueryKeys.NOTIFICATION_PREFERENCES], queryFn: getNotificationPreferences });

export const useUpdateNotificationPreference = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationPreference,
    onSuccess: (data) => qc.setQueryData([QueryKeys.NOTIFICATION_PREFERENCES], data),
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "error" }),
  });
};

/** Push on this device (§12): browser permission + Web Push subscription registered with the API. */
export const usePushNotifications = () => {
  const qc = useQueryClient();
  const supported = platform.notifications.push.supported();
  // Web Push needs the server's VAPID key; the native apps use FCM device tokens instead.
  const isWeb = platform.is("web");
  const config = useQuery({ queryKey: [QueryKeys.PUSH_CONFIG], queryFn: getPushConfig, staleTime: Infinity, enabled: supported && isWeb });
  const current = useQuery({ queryKey: [QueryKeys.PUSH_SUBSCRIPTION], queryFn: () => platform.notifications.push.current(), enabled: supported });
  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      if (on) {
        const key = config.data?.vapid_public_key ?? null;
        if (isWeb && !key) throw new Error("Push notifications aren't set up on this server yet.");
        await savePushSubscription(await platform.notifications.push.subscribe(key));
      } else {
        await platform.notifications.push.unsubscribe();
        await deletePushSubscription();
      }
      return on;
    },
    onSuccess: (on) => {
      qc.invalidateQueries({ queryKey: [QueryKeys.PUSH_SUBSCRIPTION] });
      toast({ title: on ? "Push notifications are on for this device" : "Push notifications are off for this device", duration: 2000 });
    },
    onError: (e: Error) => toast({ title: "Could not change push notifications", description: e.message, variant: "error" }),
  });
  return {
    supported,
    available: !isWeb || !!config.data?.vapid_public_key,
    enabled: !!current.data,
    permission: platform.notifications.permission(),
    loading: (isWeb && config.isPending) || current.isPending,
    toggle,
  };
};
