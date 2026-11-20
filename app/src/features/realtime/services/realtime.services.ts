import { io, type Socket } from "socket.io-client";
import { environments } from "@/config/environments";
import { refreshSession } from "@/config/api/axios";
import { getAuthStoreState } from "@/stores/auth";
import { platform } from "@/platform";
import { SocketEvents, StreamKinds, RealtimeStreams, type DeviceCall, type DeviceHello } from "@/features/realtime/interfaces/realtime.interfaces";

export interface StreamEvent<T = any> {
  stream: string;
  id: string;
  type: string;
  data: T;
  at: string;
}

type Listener = (e: StreamEvent) => void;
type ResyncListener = (stream: string) => void;

/**
 * One real-time connection per client (§14.4). Remembers the last entry ID per stream so a reconnecting client
 * resumes exactly where it stopped; if it's too far behind, the server asks it to resync from the database.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private lastIds = new Map<string, string>();
  private conversations = new Set<string>();
  private listeners = new Set<Listener>();
  private resyncListeners = new Set<ResyncListener>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private disposeLifecycle: (() => void) | null = null;
  private deviceListeners = new Set<(call: DeviceCall) => void>();
  private deviceReadyListeners = new Set<(deviceId: string) => void>();
  connected = false;
  /** Set when this app is a registered device (desktop/mobile app), from the server's "ready" event. */
  deviceId: string | null = null;

  connect() {
    if (this.socket) return;
    const socket = io(`${environments.REALTIME_URL}/realtime`, {
      transports: ["websocket"],
      auth: (cb) => cb({ token: getAuthStoreState().access_token }),
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    this.socket = socket;
    socket.on(SocketEvents.READY, (info?: { device_id?: string | null }) => {
      this.setConnected(true);
      this.subscribeAll();
      this.deviceId = info?.device_id ?? null;
      if (this.deviceId) this.deviceReadyListeners.forEach((l) => l(this.deviceId!));
    });
    socket.on(SocketEvents.DEVICE_CALL, (call: DeviceCall) => this.deviceListeners.forEach((l) => l(call)));
    socket.on(SocketEvents.DISCONNECT, () => this.setConnected(false));
    socket.on(SocketEvents.AUTH_ERROR, async () => {
      const token = await refreshSession();
      if (token) setTimeout(() => socket.connect(), 300);
    });
    socket.on(SocketEvents.EVENT, (e: StreamEvent) => {
      const last = this.lastIds.get(e.stream);
      if (last && compareIds(e.id, last) <= 0) return; // already seen (replay overlap)
      this.lastIds.set(e.stream, e.id);
      this.listeners.forEach((l) => l(e));
    });
    socket.on(SocketEvents.RESYNC, ({ stream }: { stream: string }) => {
      this.lastIds.delete(stream);
      this.resyncListeners.forEach((l) => l(stream));
    });
    socket.on(SocketEvents.SUBSCRIBED, ({ stream, last_id }: { stream: string; last_id: string }) => {
      if (!this.lastIds.has(stream) && last_id) this.lastIds.set(stream, last_id);
    });
    this.disposeLifecycle = platform.lifecycle.onResume(() => {
      if (!socket.connected) socket.connect();
    });
  }

  /** Closes the socket but keeps watched conversations and cursors, so a reconnect resumes them. */
  disconnect() {
    this.disposeLifecycle?.();
    this.socket?.disconnect();
    this.socket = null;
    this.setConnected(false);
  }

  /** Sign-out: forget everything. */
  reset() {
    this.disconnect();
    this.conversations.clear();
    this.lastIds.clear();
  }

  private setConnected(v: boolean) {
    this.connected = v;
    this.statusListeners.forEach((l) => l(v));
  }

  private subscribeAll() {
    this.socket?.emit(SocketEvents.SUBSCRIBE, { stream: StreamKinds.USER, last_id: this.lastIds.get(RealtimeStreams.USER) });
    for (const id of this.conversations) this.socket?.emit(SocketEvents.SUBSCRIBE, { stream: StreamKinds.CONVERSATION, conversation_id: id, last_id: this.lastIds.get(`${RealtimeStreams.CONVERSATION_PREFIX}${id}`) });
  }

  watchConversation(id: string) {
    this.conversations.add(id);
    if (this.socket?.connected) this.socket.emit(SocketEvents.SUBSCRIBE, { stream: StreamKinds.CONVERSATION, conversation_id: id, last_id: this.lastIds.get(`${RealtimeStreams.CONVERSATION_PREFIX}${id}`) });
    return () => {
      this.conversations.delete(id);
      this.socket?.emit(SocketEvents.UNSUBSCRIBE, { conversation_id: id });
    };
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  onResync(l: ResyncListener) {
    this.resyncListeners.add(l);
    return () => {
      this.resyncListeners.delete(l);
    };
  }

  /** Device tools (§14.3): fires on every (re)connect of a registered device; the host then sends its hello. */
  onDeviceReady(l: (deviceId: string) => void) {
    this.deviceReadyListeners.add(l);
    if (this.deviceId && this.connected) l(this.deviceId);
    return () => {
      this.deviceReadyListeners.delete(l);
    };
  }

  onDeviceCall(l: (call: DeviceCall) => void) {
    this.deviceListeners.add(l);
    return () => {
      this.deviceListeners.delete(l);
    };
  }

  sendDeviceHello(hello: DeviceHello) {
    this.socket?.emit(SocketEvents.DEVICE_HELLO, hello);
  }

  sendDeviceResult(result: { request_id: string; ok: boolean; data?: unknown; error?: string }) {
    this.socket?.emit(SocketEvents.DEVICE_RESULT, result);
  }

  onStatus(l: (connected: boolean) => void) {
    this.statusListeners.add(l);
    return () => {
      this.statusListeners.delete(l);
    };
  }
}

function compareIds(a: string, b: string) {
  const [am, as] = a.split("-").map(Number);
  const [bm, bs] = b.split("-").map(Number);
  return am - bm || as - bs;
}

export const realtime = new RealtimeClient();
