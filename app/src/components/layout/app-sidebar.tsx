import type { FC, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AlarmClock, AppWindow, Bell, Bot, CheckCheck, KeyRound, ListChecks, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plug, Plus, Search, Settings, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { OrgSwitcher } from "./org-switcher";
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
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
};

/** Left sidebar (288px desktop, 72px rail on tablet). DESIGN.MD App shell. */
export const AppSidebar: FC<{ collapsed?: boolean; onNavigate?: () => void; className?: string; showCollapseToggle?: boolean }> = ({ collapsed, onNavigate, className, showCollapseToggle = true }) => {
  const { data: conversations, isPending } = useConversations();
  const { data: approvals } = useApprovals();
  const { data: notifications } = useNotifications();
  const { data: me } = useMe();
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const signOut = useSignOut();
  const updateSettings = useUpdateSettings({ silent: true });
  const navigate = useNavigate();
  const dark = me?.settings.theme === Themes.DARK || (me?.settings.theme === Themes.SYSTEM && document.documentElement.classList.contains("dark"));

  return (
    <aside className={cn("flex h-full flex-col bg-surface-soft", collapsed ? "w-[72px]" : "w-[288px]", className)} aria-label="Main navigation">
      <div className={cn("flex items-center gap-1 p-3 pb-2", collapsed && "flex-col")}>
        <div className="min-w-0 flex-1">
          <OrgSwitcher collapsed={collapsed} />
        </div>
        {showCollapseToggle && (
          <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>

      <div className={cn("flex gap-2 px-3 pb-3", collapsed && "flex-col items-center")}>
        <Button
          className={cn("flex-1", collapsed && "h-10 w-10 flex-none p-0")}
          onClick={() => {
            navigate(Routes.chat.root);
            onNavigate?.();
          }}
          aria-label="New chat"
        >
          <Plus /> {!collapsed && "New chat"}
        </Button>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setCommandOpen(true)} aria-label="Search (Ctrl+K)">
          <Search />
        </Button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-3">
        {isPending ? <ConversationListSkeleton /> : conversations?.length ? <GroupedConversations conversations={conversations} collapsed={collapsed} onNavigate={onNavigate} /> : !collapsed && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No conversations yet. Start one with a bot</p>}
      </div>

      <nav className="space-y-0.5 border-t border-hairline p-2">
        <NavItem to={Routes.tasks.root} icon={<ListChecks />} label="Tasks" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.automations.root} icon={<AlarmClock />} label="Automations" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.approvals.root} icon={<CheckCheck />} label="Approvals" badge={approvals?.length} badgeTone={BadgeTones.ATTENTION} collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.bots.root} icon={<Bot />} label="Bots" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.artifacts.root} icon={<AppWindow />} label="Artifacts" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.skills.root} icon={<Sparkles />} label="Skills" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.connections.root} icon={<Plug />} label="Connections" collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem to={Routes.secrets} icon={<KeyRound />} label="Secrets" collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

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
    </aside>
  );
};
