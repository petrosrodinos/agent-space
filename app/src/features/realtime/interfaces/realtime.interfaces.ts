/** Live event streams (§14.4). Must match the API's EventsService names. */
export const RealtimeStreams = { USER: "user", CONVERSATION_PREFIX: "conversation:" } as const;

export const UserEventTypes = {
  NOTIFICATION: "notification",
  TASK_UPDATED: "task.updated",
  CONVERSATIONS_CHANGED: "conversations.changed",
  APPROVALS_CHANGED: "approvals.changed",
  CONNECTION_STATUS: "connection.status",
  AUTOMATIONS_CHANGED: "automations.changed",
  ARTIFACT_UPDATED: "artifact.updated",
  COMPUTER_STATUS: "computer.status",
  VOICE_ENDED: "voice.ended",
} as const;
export type UserEventType = (typeof UserEventTypes)[keyof typeof UserEventTypes];

export const ConversationEventTypes = {
  MESSAGE_CREATED: "message.created",
  MESSAGE_UPDATED: "message.updated",
  MESSAGE_DELTA: "message.delta",
  MESSAGE_DELETED: "message.deleted",
  RUN_STATUS: "run.status",
  RUN_STEP: "run.step",
  APPROVAL_CREATED: "approval.created",
  APPROVAL_RESOLVED: "approval.resolved",
  CONVERSATION_UPDATED: "conversation.updated",
  REACTION: "message.reaction",
} as const;
export type ConversationEventType = (typeof ConversationEventTypes)[keyof typeof ConversationEventTypes];

/** Socket.IO protocol events between the app and the /realtime gateway. */
export const SocketEvents = {
  READY: "ready",
  DISCONNECT: "disconnect",
  AUTH_ERROR: "auth_error",
  EVENT: "event",
  RESYNC: "resync",
  SUBSCRIBE: "subscribe",
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBE: "unsubscribe",
  /** Device tools (§14.3): the desktop app announces itself, receives calls and answers them. */
  DEVICE_HELLO: "device:hello",
  DEVICE_CALL: "device:call",
  DEVICE_RESULT: "device:result",
} as const;

/** A device tool call from the API (mirrors the API's DeviceCall). */
export interface DeviceCall {
  request_id: string;
  device_id: string;
  tool: string;
  op: string;
  args: Record<string, unknown>;
  permission: "ASK_EACH_TIME" | "ALWAYS_ALLOW" | "NEVER";
  run_id: string;
  conversation_id: string | null;
  bot: { id: string; name: string; avatar_seed: string; color: string };
  summary: string;
  timeout_ms: number;
}

export interface DeviceHello {
  capabilities: string[];
  local_tools: unknown[];
  allowed_folders: string[];
  blocked_apps: string[];
}

/** Subscription kinds sent with SocketEvents.SUBSCRIBE. */
export const StreamKinds = { USER: "user", CONVERSATION: "conversation" } as const;
