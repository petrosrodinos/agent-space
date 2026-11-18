/** KeyboardEvent.key values the app reacts to. */
export const Keys = {
  ENTER: "Enter",
  ESCAPE: "Escape",
  TAB: "Tab",
  SPACE: " ",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
} as const;

/** Letters used with Ctrl/Cmd for app shortcuts. */
export const ShortcutKeys = { COMMAND_PALETTE: "k", NEW_CHAT: "n" } as const;

/** RTCPeerConnection.connectionState / RTCDataChannel.readyState values. */
export const RtcConnectionStates = { CONNECTED: "connected", DISCONNECTED: "disconnected", FAILED: "failed" } as const;
export const DataChannelStates = { OPEN: "open" } as const;

/** Notification / permission states reported by the browser. */
export const PermissionStates = { GRANTED: "granted", DENIED: "denied", DEFAULT: "default", UNSUPPORTED: "unsupported" } as const;

/** URL.protocol values. */
export const UrlProtocols = { HTTPS: "https:", HTTP: "http:" } as const;

/** Where the refresh token lives: httpOnly cookie on web, secure storage in native/desktop shells. */
export const RefreshTokenModes = { COOKIE: "cookie", SECURE: "secure" } as const;

/** AxiosError.message when the request never reached the server. */
export const AXIOS_NETWORK_ERROR = "Network Error";

/** IANA zone used when none is known. */
export const DEFAULT_TIMEZONE = "UTC";
