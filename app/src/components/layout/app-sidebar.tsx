import type { FC, ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Bell, ChevronUp, Grid2x2Plus } from "lucide-react";
import { Routes } from "@/routes/routes";
import { PersonAvatar } from "@/components/ui/bot-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConversations } from "@/features/conversations/hooks/use-conversations";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { useMe } from "@/features/users/hooks/use-users";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { ChatActions } from "./new-chat/chat-actions";
import { BadgeTones, isPathWithin, useWorkspaceLinks, type BadgeTone, type WorkspaceLink } from "./workspace-links";
import { ConversationListSkeleton, GroupedConversations } from "./conversation-list";

const NavItem: FC<{ to: string; icon: ReactNode; label: string; badge?: number; collapsed?: boolean; badgeTone?: BadgeTone; onNavigate?: () => void }> = ({
  to,
  icon,
  label,
  badge,
  collapsed,
  badgeTone = BadgeTones.PRIMARY,
  onNavigate,
}) => {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-[40px] items-center gap-3 rounded-md px-3 text-[15px] font-bold transition-colors [&_svg]:h-5 [&_svg]:w-5",
          isActive ? "bg-primary-soft text-accent-foreground" : "text-body hover:bg-surface-sunken",
          collapsed && "justify-center px-0",
        )
      }
    >
      <span className="relative">
        {icon}
        {collapsed && !!badge && <span className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full", badgeTone === BadgeTones.ATTENTION ? "bg-sunshine" : "bg-primary")} />}
      </span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && !!badge && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold",
            badgeTone === BadgeTones.ATTENTION ? "bg-sunshine text-ink" : "bg-primary text-primary-foreground",
          )}
        >
          {badge}
        </span>
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

/**
 * Secondary workspace links. Folded by default so the conversation list gets the vertical space;
 * while folded, the link for the current page and any link with a pending badge stay visible.
 * The open/closed choice is persisted in the UI store.
 */
const WorkspaceNav: FC<{ collapsed?: boolean; onNavigate?: () => void }> = ({ collapsed, onNavigate }) => {
  const expanded = useUiStore((s) => s.nav_expanded);
  const setExpanded = useUiStore((s) => s.setNavExpanded);
  const { pathname } = useLocation();

  const entries = useWorkspaceLinks();
  const isPinned = (e: WorkspaceLink) => isPathWithin(pathname, e.to) || !!e.badge;
  const toggleLabel = expanded ? "Hide workspace links" : "Show workspace links";

  const toggle = (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      aria-controls="workspace-nav"
      aria-label={collapsed ? toggleLabel : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-body",
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
                  <NavItem to={e.to} icon={<e.icon />} label={e.label} badge={e.badge} badgeTone={e.badgeTone} collapsed={collapsed} onNavigate={onNavigate} />
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
  const { data: notifications } = useNotifications();
  const { data: me } = useMe();

  return (
    <aside className={cn("flex h-full flex-col bg-surface-soft", collapsed ? "w-[72px]" : "w-[288px]", className)} aria-label="Main navigation">
      <div className={cn("flex p-3", collapsed ? "justify-center" : "justify-end")}>
        <ChatActions vertical={collapsed} onSelect={onNavigate} />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-3">
        {isPending ? (
          <ConversationListSkeleton />
        ) : conversations?.length ? (
          <GroupedConversations conversations={conversations} collapsed={collapsed} onNavigate={onNavigate} />
        ) : (
          !collapsed && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No conversations yet. Start one with a bot</p>
        )}
      </div>

      <WorkspaceNav collapsed={collapsed} onNavigate={onNavigate} />

      <div className={cn("flex items-center gap-1 border-t border-hairline p-2", collapsed && "flex-col")}>
        <AccountMenu>
          <button
            className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-full p-1.5 pr-3 text-left hover:bg-surface-sunken", collapsed && "flex-none justify-center pr-1.5")}
            aria-label="Account menu"
          >
            <PersonAvatar name={me?.user.name} email={me?.user.email} size={32} />
            {!collapsed && <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{me?.user.name ?? "…"}</span>}
            {!collapsed && !!notifications?.unread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                <Bell className="h-3 w-3" />
                {notifications.unread}
              </span>
            )}
          </button>
        </AccountMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={Routes.connections.root}
              onClick={onNavigate}
              aria-label="Connections"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink transition-colors hover:bg-hairline-strong [&_svg]:h-[18px] [&_svg]:w-[18px]"
            >
              <Grid2x2Plus />
            </Link>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>Connections</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};
