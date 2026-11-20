import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * The in-app native plugin (Kotlin: app/android/app/src/main/java/com/agentspace/app/AgentSpacePlugin.kt).
 * Android only — always check `isAgentSpaceNativeAvailable()` first: a web-only (over-the-air) update can run inside
 * an older app build that doesn't have the plugin yet.
 */
export const AGENT_SPACE_PLUGIN = "AgentSpace";

export interface NativeSessionInput {
  /** API base URL including the `/api` prefix (environments.API_URL). */
  apiUrl: string;
  organizationId: string | null;
  accessToken: string | null;
  /** Access token expiry, epoch milliseconds. */
  accessExpiresAt: number | null;
}

export interface TaskProgressInput {
  /** Stable id for the task (e.g. the run id); the same id updates the same notification. */
  id: string;
  title: string;
  text?: string;
  /** Leave out progress/max for an indeterminate bar. */
  progress?: number;
  max?: number;
  /** In-app path opened when the notification is tapped, e.g. Routes.tasks.detail(id). */
  url?: string;
}

export interface TaskProgressEnd {
  id: string;
  /** With a title the notification stays as a dismissible "done" note; without, it's removed. */
  title?: string;
  text?: string;
  url?: string;
}

interface AgentSpaceNativePlugin {
  getRefreshToken(): Promise<{ token?: string }>;
  setRefreshToken(options: { token: string | null }): Promise<void>;
  setSession(options: NativeSessionInput): Promise<void>;
  clearSession(): Promise<void>;
  recognizeText(options: { path: string }): Promise<{ text: string }>;
  showProgress(options: TaskProgressInput): Promise<{ shown: boolean }>;
  endProgress(options: TaskProgressEnd): Promise<void>;
  refreshWidgets(): Promise<void>;
}

export const AgentSpaceNative = registerPlugin<AgentSpaceNativePlugin>(AGENT_SPACE_PLUGIN);

export const isAgentSpaceNativeAvailable = () => Capacitor.isPluginAvailable(AGENT_SPACE_PLUGIN);
