import type { PushRegistration } from "@/platform/types";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request, type Paginated } from "@/lib/request";
import type { AppNotification, NotificationChannel, NotificationPreference } from "../interfaces/notifications.interfaces";
import { PushProviders } from "../interfaces/notifications.interfaces";

export const getNotifications = (params: { unread?: boolean; page?: number } = {}) => request<Paginated<AppNotification> & { unread: number }>(() => axiosInstance.get(ApiRoutes.notifications.root, { params: { ...params, limit: 30 } }));
export const markNotificationRead = (id: string) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.notifications.read(id)));
export const markAllNotificationsRead = () => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.notifications.read_all));
export const getNotificationPreferences = () => request<NotificationPreference[]>(() => axiosInstance.get(ApiRoutes.notifications.preferences));
export const updateNotificationPreference = (dto: { event: string; enabled: boolean; channels: NotificationChannel[] }) => request<NotificationPreference[]>(() => axiosInstance.patch(ApiRoutes.notifications.preferences, dto));
export const getPushConfig = () => request<{ vapid_public_key: string | null }>(() => axiosInstance.get(ApiRoutes.app.push_config));
export const savePushSubscription = (reg: PushRegistration) =>
  request<{ enabled: boolean }>(
    () => axiosInstance.post(ApiRoutes.push.subscription, reg.provider === PushProviders.WEBPUSH ? { endpoint: reg.subscription.endpoint, keys: reg.subscription.keys } : { provider: reg.provider, token: reg.token }),
    "Could not turn on push notifications.",
  );
export const deletePushSubscription = () => request<{ enabled: boolean }>(() => axiosInstance.delete(ApiRoutes.push.subscription));
