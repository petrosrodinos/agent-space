import { NEW_SKILL_ID } from "@/features/skills/interfaces/skills.interfaces";
import { ConversationViews } from "@/features/conversations/interfaces/conversations.interfaces";
/** Every screen has a stable path (§14.1) — notifications, emails and deep links open these. */
export const Routes = {
  home: "/",
  /** Public landing page; `/` also shows it to signed-out web visitors. */
  welcome: "/welcome",
  auth: {
    sign_in: "/auth/sign-in",
    sign_up: "/auth/sign-up",
    forgot_password: "/auth/forgot-password",
    reset_password: "/auth/reset-password",
  },
  invite: (token: string) => `/invite/${token}`,
  invite_pattern: "/invite/:token",
  /** Public read-only view of a shared conversation (no sign-in). */
  shared: (token: string) => `/s/${token}`,
  shared_pattern: "/s/:token",
  chat: {
    root: "/c",
    conversation: (id: string) => `/c/${id}`,
    /** Phones: the bot / details panel as its own page (wider screens show it beside the chat). */
    details: (id: string) => `/c/${id}/${ConversationViews.DETAILS}`,
    /** `view` is optional: absent for the chat, `details` for the panel page. */
    pattern: "/c/:conversationId/:view?",
  },
  bots: {
    root: "/bots",
    new: "/bots/new",
    detail: (id: string) => `/bots/${id}`,
    pattern: "/bots/:botId",
  },
  skills: {
    root: "/skills",
    new: `/skills/${NEW_SKILL_ID}`,
    detail: (id: string) => `/skills/${id}`,
    pattern: "/skills/:skillId",
  },
  connections: {
    root: "/connections",
    callback: "/connections/callback",
    mcp_callback: "/connections/mcp-callback",
    legacy_callback: "/integrations/callback",
    service: (slug: string) => `/connections/services/${slug}`,
    service_pattern: "/connections/services/:serviceSlug",
    tool_server: (id: string) => `/connections/tool-servers/${id}`,
    tool_server_pattern: "/connections/tool-servers/:toolServerId",
  },
  secrets: "/secrets",
  tools: "/tools",
  tasks: { root: "/tasks", detail: (id: string) => `/tasks/${id}`, pattern: "/tasks/:taskId" },
  artifacts: { root: "/artifacts", detail: (id: string) => `/artifacts/${id}`, pattern: "/artifacts/:artifactId" },
  widgets: { root: "/widgets", detail: (id: string) => `/widgets/${id}`, pattern: "/widgets/:widgetId" },
  automations: { root: "/automations", detail: (id: string) => `/automations/${id}`, pattern: "/automations/:automationId" },
  approvals: { root: "/approvals", detail: (id: string) => `/approvals/${id}`, pattern: "/approvals/:approvalId" },
  settings: {
    root: "/settings",
    profile: "/settings/profile",
    appearance: "/settings/appearance",
    replies: "/settings/replies",
    notifications: "/settings/notifications",
    memory: "/settings/memory",
    security: "/settings/security",
    devices: "/settings/devices",
    channels: "/settings/message-from-anywhere",
    organization: "/settings/organization",
    members: "/settings/members",
    ai_models: "/settings/ai-models",
    knowledge: "/settings/knowledge",
    safety: "/settings/safety",
    usage: "/settings/usage",
    activity: "/settings/activity",
    danger: "/settings/danger",
  },
};
