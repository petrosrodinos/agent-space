import {
  AppWindow,
  ArrowLeftRight,
  BookOpen,
  Bot,
  Brain,
  Camera,
  CheckCircle2,
  Cpu,
  FileText,
  Globe,
  Hand,
  KeyRound,
  Keyboard,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Monitor,
  MousePointerClick,
  Plug,
  Search,
  Settings,
  SquareTerminal,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Agent tool names the API sends in activity steps (§7.3). Must match api/src/modules/agent/tools. */
export const ToolNames = {
  WEB_SEARCH: "web_search",
  READ_WEBPAGE: "read_webpage",
  REMEMBER: "remember",
  FORGET: "forget",
  SHOW_UI: "show_ui",
  CREATE_DOCUMENT: "create_document",
  REQUEST_SECRET: "request_secret",
  LIST_SECRETS: "list_secrets",
  UPDATE_SECRET: "update_secret",
  DELETE_SECRET: "delete_secret",
  LIST_BOTS: "list_bots",
  LIST_MODELS: "list_models",
  UPDATE_BOT: "update_bot",
  UPDATE_MY_SETTINGS: "update_my_settings",
  USE_SKILL: "use_skill",
  LIST_SKILLS: "list_skills",
  CREATE_SKILL: "create_skill",
  UPDATE_SKILL: "update_skill",
  ASSIGN_SKILL: "assign_skill",
  ASK_BOT: "ask_bot",
  SEARCH_KNOWLEDGE: "search_knowledge",
  READ_KNOWLEDGE: "read_knowledge",
  READ_FILE: "read_file",
  CALL_API: "call_api",
  COPY_TO_COMPUTER: "copy_to_computer",
  COPY_FROM_COMPUTER: "copy_from_computer",
  COMPUTER_RUN: "computer_run",
  COMPUTER_OPEN_URL: "computer_open_url",
  COMPUTER_SCREENSHOT: "computer_screenshot",
  COMPUTER_CLICK: "computer_click",
  COMPUTER_TYPE: "computer_type",
  COMPUTER_KEY: "computer_key",
  COMPUTER_ASK_USER: "computer_ask_user",
  RESOLVE_APPROVAL: "resolve_approval",
  START_TASK: "start_task",
  END_VOICE: "end_voice",
} as const;

/** Tool-name prefixes for families of tools. */
export const ToolNamePrefixes = {
  COMPUTER: "computer_",
  ARTIFACT: "_artifact",
  AUTOMATION: "automation",
  MCP: "mcp_",
} as const;

const EXACT: Record<string, LucideIcon> = {
  [ToolNames.WEB_SEARCH]: Search,
  [ToolNames.READ_WEBPAGE]: Globe,
  [ToolNames.REMEMBER]: Brain,
  [ToolNames.FORGET]: Brain,
  [ToolNames.SHOW_UI]: LayoutDashboard,
  [ToolNames.CREATE_DOCUMENT]: FileText,
  [ToolNames.REQUEST_SECRET]: KeyRound,
  [ToolNames.LIST_SECRETS]: KeyRound,
  [ToolNames.UPDATE_SECRET]: KeyRound,
  [ToolNames.DELETE_SECRET]: KeyRound,
  [ToolNames.LIST_BOTS]: Bot,
  [ToolNames.LIST_MODELS]: Cpu,
  [ToolNames.UPDATE_BOT]: Settings,
  [ToolNames.UPDATE_MY_SETTINGS]: Settings,
  [ToolNames.USE_SKILL]: BookOpen,
  [ToolNames.LIST_SKILLS]: BookOpen,
  [ToolNames.CREATE_SKILL]: BookOpen,
  [ToolNames.UPDATE_SKILL]: BookOpen,
  [ToolNames.ASSIGN_SKILL]: BookOpen,
  [ToolNames.ASK_BOT]: Bot,
  [ToolNames.SEARCH_KNOWLEDGE]: Library,
  [ToolNames.READ_KNOWLEDGE]: Library,
  [ToolNames.READ_FILE]: FileText,
  [ToolNames.CALL_API]: Plug,
  [ToolNames.COPY_TO_COMPUTER]: ArrowLeftRight,
  [ToolNames.COPY_FROM_COMPUTER]: ArrowLeftRight,
  [ToolNames.COMPUTER_RUN]: SquareTerminal,
  [ToolNames.COMPUTER_OPEN_URL]: Globe,
  [ToolNames.COMPUTER_SCREENSHOT]: Camera,
  [ToolNames.COMPUTER_CLICK]: MousePointerClick,
  [ToolNames.COMPUTER_TYPE]: Keyboard,
  [ToolNames.COMPUTER_KEY]: Keyboard,
  [ToolNames.COMPUTER_ASK_USER]: Hand,
  [ToolNames.RESOLVE_APPROVAL]: CheckCircle2,
  [ToolNames.START_TASK]: ListChecks,
  [ToolNames.END_VOICE]: LogOut,
};

/** Icon shown next to an activity step, by tool name (exact name first, then tool family). */
export function toolIcon(name: string): LucideIcon {
  if (EXACT[name]) return EXACT[name];
  if (name.startsWith(ToolNamePrefixes.COMPUTER)) return Monitor;
  if (name.endsWith(ToolNamePrefixes.ARTIFACT) || name.endsWith(`${ToolNamePrefixes.ARTIFACT}s`) || name.includes(ToolNamePrefixes.ARTIFACT)) return AppWindow;
  if (name.startsWith(ToolNamePrefixes.AUTOMATION) || name.includes(`_${ToolNamePrefixes.AUTOMATION}`)) return Timer;
  if (name.startsWith(ToolNamePrefixes.MCP)) return Wrench;
  // Connected-service tools (Composio slugs such as GMAIL_SEND_EMAIL).
  if (name === name.toUpperCase()) return Plug;
  return Wrench;
}
