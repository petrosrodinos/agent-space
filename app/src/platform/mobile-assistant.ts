/**
 * Google Assistant App Actions, launcher shortcuts and home-screen widgets (§14.2) open `agentspace://assistant/…`
 * links (app/android/app/src/main/res/xml/shortcuts.xml, core/AppLinks.kt). They aren't app routes: native.ts hands
 * them here instead of navigating, and the mobile host (components/layout/mobile-device-host.tsx) resolves the bot or
 * automation by name and opens the right screen. Intents are kept until the host listens (cold start).
 */
export const ASSISTANT_PATH_PREFIX = "/assistant/";

export const AssistantActions = {
  /** `?bot=<name>&text=<question>` — open (and ask) a bot; no bot = new chat. */
  ASK: "ask",
  /** `?bot=<name>` — voice mode with a bot; no bot = the most recent chat. */
  VOICE: "voice",
  /** `?automation=<name>` — run an automation now. */
  RUN: "run",
  /** `?feature=<words>` — Assistant's OPEN_APP_FEATURE ("approvals", "tasks", "settings"…). */
  FEATURE: "feature",
} as const;
export type AssistantAction = (typeof AssistantActions)[keyof typeof AssistantActions];

export const AssistantParams = { BOT: "bot", TEXT: "text", AUTOMATION: "automation", FEATURE: "feature" } as const;

/**
 * Query flag added to a conversation path when voice mode should start on arrival. The conversation page doesn't
 * read it yet — whoever owns pages/chat/pages/conversation should start voice mode when `?voice=1` is present.
 */
export const VOICE_ON_OPEN_PARAM = "voice";

export interface AssistantIntent {
  action: AssistantAction;
  params: URLSearchParams;
}

const ACTIONS = new Set<string>(Object.values(AssistantActions));
let pending: AssistantIntent | null = null;
const listeners = new Set<(intent: AssistantIntent) => void>();

export const isAssistantPath = (path: string) => path.startsWith(ASSISTANT_PATH_PREFIX);

/** Parses `/assistant/ask?bot=…` into an intent, or null for anything else. */
export function parseAssistantPath(path: string): AssistantIntent | null {
  if (!isAssistantPath(path)) return null;
  const [action, query = ""] = path.slice(ASSISTANT_PATH_PREFIX.length).split("?");
  const name = action.replace(/\/+$/, "");
  return ACTIONS.has(name) ? { action: name as AssistantAction, params: new URLSearchParams(query) } : null;
}

export function emitAssistantIntent(intent: AssistantIntent) {
  if (listeners.size) listeners.forEach((cb) => cb(intent));
  else pending = intent;
}

export function onAssistantIntent(cb: (intent: AssistantIntent) => void): () => void {
  listeners.add(cb);
  if (pending) {
    const intent = pending;
    pending = null;
    cb(intent);
  }
  return () => {
    listeners.delete(cb);
  };
}
