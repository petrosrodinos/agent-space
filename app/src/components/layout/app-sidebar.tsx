import { useState, type FC, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AlarmClock, AppWindow, Bell, Bot, CheckCheck, ChevronUp, KeyRound, ListChecks, LogOut, Moon, Plug, Settings, Sparkles, Sun } from "lucide-react";
import { PersonAvatar } from "@/components/ui/bot-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConversations } from "@/features/conversations/hooks/use-conversations";
import { useApprovals } from "@/features/tasks/hooks/use-tasks";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { useMe, useUpdateSettings } from "@/features/users/hooks/use-users";
import { useSignOut } from "@/features/auth/hooks/use-auth";
import { useUiStore } from "@/stores/ui";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { CreateOrganizationDialog, OrgSubmenu } from "./org-switcher";
import { ChatActions } from "./new-chat/chat-actions";
import { ConversationListSkeleton, GroupedConversations } from "./conversation-list";
import { Themes } from "@/features/users/interfaces/users.interfaces";

const BadgeTones = { PRIMARY: "primary", ATTENTION: "attention" } as const;
type BadgeTone = (typeof BadgeTones)[keyof typeof BadgeTones];

const NavItem: FC<{ to: string; icon: ReactNode; label: string; badge?: number; collapsed?: boolean; badgeTone?: BadgeTone; onNavigate?: () => void }> = ({ to, icon, label, badge, collapsed, badgeTone = BadgeTones.PRIMARY, onNavigate }) => {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn("flex min-h-[40px] items-center gap-3 rounded-[12px] px-3 text-[15px] font-bold transition-colors [&_svg]:h-5 [&_svg]:w-5", isActive ? "bg-primary-soft text-accent-foreground" : "text-body hover:bg-surface-sunken", collapsed && "justify-center px-0")
      }
    >
      <span className="relative">
        {icon}
        {collapsed && !!badge && <span className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full", badgeTone === BadgeTones.ATTENTION ? "bg-sunshine" : "bg-primary")} />}
      </span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && !!badge && (
        <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold", badgeTone === BadgeTones.ATTENTION ? "bg-sunshine text-ink" : "bg-primary text-primary-foreground")}>{badge}</span>
      )}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col">{link}</div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
};

interface WorkspaceNavEntry {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
  badgeTone?: BadgeTone;
}

/**
 * Secondary workspace links. Folded by default so the conversation list gets the vertical space;
 * while folded, the link for the current page and any link with a pending badge stay visible.
 * The open/closed choice is persisted in the UI store.
 */
const WorkspaceNav: FC<{ collapsed?: boolean; approvalsCount?: number; onNavigate?: () => void }> = ({ collapsed, approvalsCount, onNavigate }) => {
  const expanded = useUiStore((s) => s.nav_expanded);
  const setExpanded = useUiStore((s) => s.setNavExpanded);
  const { pathname } = useLocation();

  const entries: WorkspaceNavEntry[] = [
    { to: Routes.tasks.root, icon: <ListChecks />, label: "Tasks" },
    { to: Routes.automations.root, icon: <AlarmClock />, label: "Automations" },
    { to: Routes.approvals.root, icon: <CheckCheck />, label: "Approvals", badge: approvalsCount, badgeTone: BadgeTones.ATTENTION },
    { to: Routes.bots.root, icon: <Bot />, label: "Bots" },
    { to: Routes.artifacts.root, icon: <AppWindow />, label: "Artifacts" },
    { to: Routes.skills.root, icon: <Sparkles />, label: "Skills" },
    { to: Routes.connections.root, icon: <Plug />, label: "Connections" },
    { to: Routes.secrets, icon: <KeyRound />, label: "Secrets" },
  ];
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isPinned = (e: WorkspaceNavEntry) => isActive(e.to) || !!e.badge;
  const toggleLabel = expanded ? "Hide workspace links" : "Show workspace links";

  const toggle = (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      aria-controls="workspace-nav"
      aria-label={collapsed ? toggleLabel : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-body",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      {!collapsed && <span className="flex-1 text-left">Workspace</span>}
      <ChevronUp className={cn("h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none", !expanded && "rotate-180")} />
    </button>
  );

  return (
    <nav className="border-t border-hairline p-2" aria-label="Workspace">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{toggle}</TooltipTrigger>
          <TooltipContent side="right">{toggleLabel}</TooltipContent>
        </Tooltip>
      ) : (
        toggle
      )}
      <div id="workspace-nav">
        {entries.map((e) => {
          const shown = expanded || isPinned(e);
          return (
            <div
              key={e.to}
              inert={!shown}
              className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none", shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="pt-0.5">
                  <NavItem to={e.to} icon={e.icon} label={e.label} badge={e.badge} badgeTone={e.badgeTone} collapsed={collapsed} onNavigate={onNavigate} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

/** Left sidebar (288px desktop, 72px rail on tablet). DESIGN.MD App shell. */
export const AppSidebar: FC<{ collapsed?: boolean; onNavigate?: () => void; className?: string }> = ({ collapsed, onNavigate, className }) => {
  const { data: conversations, isPending } = useConversations();
  const { data: approvals } = useApprovals();
  const { data: notifications } = useNotifications();
  const { data: me } = useMe();
  const signOut = useSignOut();
  const updateSettings = useUpdateSettings({ silent: true });
  const navigate = useNavigate();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const dark = me?.settings.theme === Themes.DARK || (me?.settings.theme === Themes.SYSTEM && document.documentElement.classList.contains("dark"));

  return (
    <aside className={cn("flex h-full flex-col bg-surface-soft", collapsed ? "w-[72px]" : "w-[288px]", className)} aria-label="Main navigation">
      <div className={cn("flex p-3", collapsed ? "justify-center" : "justify-end")}>
        <ChatActions vertical={collapsed} onSelect={onNavigate} />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-3">
        {isPending ? <ConversationListSkeleton /> : conversations?.length ? <GroupedConversations conversations={conversations} collapsed={collapsed} onNavigate={onNavigate} /> : !collapsed && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No conversations yet. Start one with a bot</p>}
      </div>

      <WorkspaceNav collapsed={collapsed} approvalsCount={approvals?.length} onNavigate={onNavigate} />

      <div className="border-t border-hairline p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex w-full items-center gap-3 rounded-[14px] p-1.5 text-left hover:bg-surface-sunken", collapsed && "justify-center")} aria-label="Account menu">
              <PersonAvatar name={me?.user.name} email={me?.user.email} size={32} />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{me?.user.name ?? "…"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{me?.user.email}</span>
                </span>
              )}
              {!collapsed && !!notifications?.unread && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                  <Bell className="h-3 w-3" />
                  {notifications.unread}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64 rounded-[14px] p-1.5 shadow-pop">
            <OrgSubmenu onCreate={() => setCreateOrgOpen(true)} />
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-[10px] py-2" onSelect={() => navigate(Routes.settings.profile)}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-[10px] py-2" onSelect={() => navigate(Routes.settings.notifications)}>
              <Bell className="h-4 w-4" /> Notifications {!!notifications?.unread && <span className="ml-auto text-xs font-bold text-primary">{notifications.unread} new</span>}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-[10px] py-2" onSelect={() => updateSettings.mutate({ theme: dark ? Themes.LIGHT : Themes.DARK })}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-[10px] py-2 text-error focus:text-error" onSelect={() => signOut.mutate()}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
    </aside>
  );
};
