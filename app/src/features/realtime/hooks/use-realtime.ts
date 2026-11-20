import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, AuthStatuses } from "@/stores/auth";
import { platform } from "@/platform";
import type { Message } from "@/features/conversations/interfaces/conversations.interfaces";
import { applyDelta, messagesKey, removeMessage, runStatusKey, upsertMessage } from "@/features/conversations/utils/messages-cache";
import { realtime } from "../services/realtime.services";
import { QueryKeys } from "@/config/constants/query-keys";
import { RealtimeStreams, UserEventTypes, ConversationEventTypes } from "../interfaces/realtime.interfaces";
import { NotificationEvents } from "@/features/notifications/interfaces/notifications.interfaces";
import { isDesktopNotificationsOn } from "@/features/notifications/hooks/use-notifications";
import { RunStatuses } from "@/features/tasks/interfaces/tasks.interfaces";

/** Connects once per signed-in session and reacts to user-stream events (sidebar, tasks, approvals, notifications). */
export function useRealtimeConnection() {
  const qc = useQueryClient();
  // useNavigate() returns a new function on every route change; keep it in a ref so navigating doesn't tear down the socket.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const signedIn = useAuthStore((s) => s.status === AuthStatuses.SIGNED_IN);

  useEffect(() => {
    if (!signedIn) return;
    realtime.connect();
    const off = realtime.on((e) => {
      if (e.stream !== RealtimeStreams.USER) return;
      switch (e.type) {
        case UserEventTypes.CONVERSATIONS_CHANGED:
          qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
          break;
        case UserEventTypes.TASK_UPDATED:
          qc.invalidateQueries({ queryKey: [QueryKeys.TASKS] });
          qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
          qc.invalidateQueries({ queryKey: [QueryKeys.TASK, e.data.run_id] });
          break;
        case UserEventTypes.AUTOMATIONS_CHANGED:
          qc.invalidateQueries({ queryKey: [QueryKeys.AUTOMATIONS] });
          qc.invalidateQueries({ queryKey: [QueryKeys.AUTOMATION, e.data.automation_id] });
          break;
        case UserEventTypes.APPROVALS_CHANGED:
          qc.invalidateQueries({ queryKey: [QueryKeys.APPROVALS] });
          qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATIONS] });
          break;
        case UserEventTypes.ARTIFACT_UPDATED:
          qc.invalidateQueries({ queryKey: [QueryKeys.ARTIFACTS] });
          qc.invalidateQueries({ queryKey: [QueryKeys.ARTIFACT, e.data.artifact_id] });
          break;
        case UserEventTypes.COMPUTER_STATUS:
          qc.invalidateQueries({ queryKey: [QueryKeys.COMPUTER, e.data.bot_id] });
          break;
        case UserEventTypes.CONNECTION_STATUS:
          qc.invalidateQueries({ queryKey: [QueryKeys.CONNECTIONS] });
          break;
        case UserEventTypes.NOTIFICATION: {
          qc.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATIONS] });
          const n = e.data as { title: string; body?: string; link_path?: string; event: string };
          const onConversation = n.link_path && window.location.pathname === n.link_path;
          if (!onConversation && n.event !== NotificationEvents.NEW_MESSAGE) {
            toast({ title: n.title, description: n.body ?? undefined, duration: 5000 });
            if (!platform.lifecycle.isVisible() && (!platform.is("desktop") || isDesktopNotificationsOn())) platform.notifications.show(n.title, { body: n.body ?? undefined, onClick: () => n.link_path && navigateRef.current(n.link_path) });
          }
          break;
        }
      }
    });
    const offResync = realtime.onResync((stream) => {
      if (stream === RealtimeStreams.USER) qc.invalidateQueries();
      else if (stream.startsWith(RealtimeStreams.CONVERSATION_PREFIX)) qc.invalidateQueries({ queryKey: messagesKey(stream.slice(RealtimeStreams.CONVERSATION_PREFIX.length)) });
    });
    return () => {
      off();
      offResync();
      realtime.disconnect();
    };
  }, [signedIn, qc]);
}

export type RunStatusMap = Record<string, { status: string; run_id: string }>;

/** Live conversation: streaming deltas, message snapshots, run status, approvals (§7.3). */
export function useConversationStream(conversationId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const stop = realtime.watchConversation(conversationId);
    const stream = `${RealtimeStreams.CONVERSATION_PREFIX}${conversationId}`;
    const off = realtime.on((e) => {
      if (e.stream !== stream) return;
      switch (e.type) {
        case ConversationEventTypes.MESSAGE_CREATED:
        case ConversationEventTypes.MESSAGE_UPDATED:
          upsertMessage(qc, e.data as Message);
          break;
        case ConversationEventTypes.MESSAGE_DELTA:
          applyDelta(qc, conversationId, e.data.message_id, e.data.index, e.data.delta);
          break;
        case ConversationEventTypes.MESSAGE_DELETED:
          removeMessage(qc, conversationId, e.data.id);
          break;
        case ConversationEventTypes.RUN_STATUS:
          qc.setQueryData<RunStatusMap>(runStatusKey(conversationId), (prev) => ({ ...(prev ?? {}), [e.data.bot_id]: { status: e.data.status, run_id: e.data.run_id } }));
          // A run may have changed bots or settings by chat (§6.6) — refresh what the header and lists show.
          if (e.data.status === RunStatuses.COMPLETED) {
            qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATION, conversationId] });
            qc.invalidateQueries({ queryKey: [QueryKeys.BOTS] });
            qc.invalidateQueries({ queryKey: [QueryKeys.BOT] });
          }
          break;
        case ConversationEventTypes.APPROVAL_CREATED:
        case ConversationEventTypes.APPROVAL_RESOLVED:
          qc.invalidateQueries({ queryKey: [QueryKeys.APPROVALS] });
          break;
        case ConversationEventTypes.CONVERSATION_UPDATED:
          qc.invalidateQueries({ queryKey: [QueryKeys.CONVERSATION, conversationId] });
          break;
      }
    });
    return () => {
      off();
      stop();
    };
  }, [conversationId, qc]);
}

/** Grace period before showing the offline banner, so the first connect and quick reconnects don't flash it. */
const OFFLINE_BANNER_DELAY_MS = 3000;

/** True once the live connection has been down for longer than the grace period. */
export function useRealtimeOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (connected: boolean) => {
      clearTimeout(timer);
      if (connected) setOffline(false);
      else timer = setTimeout(() => setOffline(true), OFFLINE_BANNER_DELAY_MS);
    };
    apply(realtime.connected);
    const off = realtime.onStatus(apply);
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);
  return offline;
}
