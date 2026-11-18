export const NotificationChannels = { IN_APP: "IN_APP", PUSH: "PUSH", EMAIL: "EMAIL" } as const;
export type NotificationChannel = (typeof NotificationChannels)[keyof typeof NotificationChannels];
export const NotificationEvents = { NEW_MESSAGE: "NEW_MESSAGE", MENTION: "MENTION", APPROVAL_NEEDED: "APPROVAL_NEEDED", TASK_FINISHED: "TASK_FINISHED", TASK_FAILED: "TASK_FAILED", CONNECTION_NEEDS_RECONNECTING: "CONNECTION_NEEDS_RECONNECTING", SECRET_NOT_WORKING: "SECRET_NOT_WORKING", INVITATION_RECEIVED: "INVITATION_RECEIVED", AUTOMATION_RESULT: "AUTOMATION_RESULT", AUTOMATION_PAUSED: "AUTOMATION_PAUSED", ARTIFACT_SHARED: "ARTIFACT_SHARED", ARTIFACT_COMMENT: "ARTIFACT_COMMENT", ARTIFACT_EDITED: "ARTIFACT_EDITED", SKILL_SHARED: "SKILL_SHARED", SKILL_CHANGED: "SKILL_CHANGED", TAKE_CONTROL_NEEDED: "TAKE_CONTROL_NEEDED", USAGE_LIMIT: "USAGE_LIMIT", MODEL_CHANGED: "MODEL_CHANGED", EXPORT_READY: "EXPORT_READY", SYSTEM: "SYSTEM" } as const;
export type NotificationEvent = (typeof NotificationEvents)[keyof typeof NotificationEvents];

export interface AppNotification {
  id: string;
  event: string;
  title: string;
  body: string | null;
  link_path: string | null;
  is_urgent: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  event: string;
  enabled: boolean;
  channels: NotificationChannel[];
}

/** Push providers (§12, §14.2). */
export const PushProviders = { WEBPUSH: "WEBPUSH", FCM: "FCM", APNS: "APNS" } as const;
export type PushProvider = (typeof PushProviders)[keyof typeof PushProviders];
