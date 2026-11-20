import { AlarmClock, AppWindow, Bot, CheckCheck, KeyRound, LayoutDashboard, ListChecks, Plug, Sparkles, type LucideIcon } from "lucide-react";
import { useApprovals } from "@/features/tasks/hooks/use-tasks";
import { Routes } from "@/routes/routes";

export const BadgeTones = { PRIMARY: "primary", ATTENTION: "attention" } as const;
export type BadgeTone = (typeof BadgeTones)[keyof typeof BadgeTones];

export const WorkspaceLinkKeys = {
  TASKS: "tasks",
  AUTOMATIONS: "automations",
  APPROVALS: "approvals",
  BOTS: "bots",
  ARTIFACTS: "artifacts",
  WIDGETS: "widgets",
  SKILLS: "skills",
  CONNECTIONS: "connections",
  SECRETS: "secrets",
} as const;
export type WorkspaceLinkKey = (typeof WorkspaceLinkKeys)[keyof typeof WorkspaceLinkKeys];

export interface WorkspaceLink {
  key: WorkspaceLinkKey;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: BadgeTone;
}

/** True when `pathname` is `to` or one of its sub-pages. */
export const isPathWithin = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

/**
 * The workspace pages (everything besides chats and settings), with live badges.
 * Single source for the desktop sidebar's Workspace section and the mobile Tools page.
 */
export const useWorkspaceLinks = (): WorkspaceLink[] => {
  const { data: approvals } = useApprovals();
  return [
    { key: WorkspaceLinkKeys.TASKS, to: Routes.tasks.root, label: "Tasks", description: "Work your bots are doing or have finished", icon: ListChecks },
    { key: WorkspaceLinkKeys.AUTOMATIONS, to: Routes.automations.root, label: "Automations", description: "Scheduled and recurring jobs for your bots", icon: AlarmClock },
    { key: WorkspaceLinkKeys.APPROVALS, to: Routes.approvals.root, label: "Approvals", description: "Actions waiting for your OK before they run", icon: CheckCheck, badge: approvals?.length, badgeTone: BadgeTones.ATTENTION },
    { key: WorkspaceLinkKeys.BOTS, to: Routes.bots.root, label: "Bots", description: "Create, edit and manage your assistants", icon: Bot },
    { key: WorkspaceLinkKeys.ARTIFACTS, to: Routes.artifacts.root, label: "Artifacts", description: "Apps, pages and files your bots have made", icon: AppWindow },
    { key: WorkspaceLinkKeys.WIDGETS, to: Routes.widgets.root, label: "Widgets", description: "Saved interactive replies, refreshed when you open them", icon: LayoutDashboard },
    { key: WorkspaceLinkKeys.SKILLS, to: Routes.skills.root, label: "Skills", description: "Reusable know-how your bots can follow", icon: Sparkles },
    { key: WorkspaceLinkKeys.CONNECTIONS, to: Routes.connections.root, label: "Connections", description: "Apps and services your bots can use", icon: Plug },
    { key: WorkspaceLinkKeys.SECRETS, to: Routes.secrets, label: "Secrets", description: "API keys and passwords stored for your bots", icon: KeyRound },
  ];
};
