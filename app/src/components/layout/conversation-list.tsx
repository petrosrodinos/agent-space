import { useMemo, type FC } from "react";
import { NavLink } from "react-router-dom";
import { Star } from "lucide-react";
import { BotAvatar, BotAvatarStack } from "@/components/ui/bot-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { botSoftColor } from "@/config/constants/dropdowns/shared/bot-colors.options";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { shortStamp } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";

export const ConversationRow: FC<{ c: Conversation; collapsed?: boolean; onNavigate?: () => void }> = ({ c, collapsed, onNavigate }) => {
  const unread = c.me?.unread_count ?? 0;
  const working = (c.working_bot_ids?.length ?? 0) > 0;
  const attention = (c.pending_approvals ?? 0) > 0;
  const lead = c.bots[0];
  return (
    <NavLink
      to={Routes.chat.conversation(c.id)}
      onClick={onNavigate}
      title={collapsed ? c.name : undefined}
      className={({ isActive }) => cn("group relative flex min-h-[52px] items-center gap-3 rounded-[14px] px-2 py-1.5 transition-colors", isActive ? "bg-[var(--row-soft)]" : "hover:bg-surface-sunken", collapsed && "justify-center px-0")}
      style={{ ["--row-soft" as string]: c.type === ConversationTypes.DIRECT ? botSoftColor(lead?.color) : "var(--primary-soft)" }}
    >
      <span className="relative">
        {c.type === ConversationTypes.GROUP ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] text-2xl" style={{ backgroundColor: c.color }}>
            {c.emoji}
          </span>
        ) : lead ? (
          <BotAvatar emoji={lead.emoji} color={lead.color} name={lead.name} working={working} />
        ) : (
          <BotAvatarStack bots={c.bots} />
        )}
        {collapsed && (unread > 0 || attention) && <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface-soft", attention ? "bg-sunshine" : "bg-primary")} />}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-[15px] text-ink", unread ? "font-extrabold" : "font-bold")}>{c.name}</span>
            {c.me?.is_favourite && <Star className="h-3 w-3 shrink-0 fill-sunshine text-sunshine" aria-label="Favourite" />}
            <span className="ml-auto shrink-0 text-[11px] font-semibold text-muted-foreground">{shortStamp(c.last_message?.created_at ?? c.last_message_at)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-[13px]", unread ? "font-semibold text-body" : "text-muted-foreground")}>
              {working ? (
                <span className="inline-flex items-center gap-1 text-accent-foreground">
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1 w-1 animate-dot rounded-full bg-current" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                  working
                </span>
              ) : attention ? (
                <span className="font-semibold text-warning">Needs your approval</span>
              ) : c.last_message ? (
                `${c.type !== ConversationTypes.DIRECT && c.last_message.author_name ? `${c.last_message.author_name}: ` : ""}${c.last_message.preview || "Attachment"}`
              ) : (
                <span className="italic">Say hi</span>
              )}
            </span>
            {attention ? (
              <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-sunshine px-1.5 text-[11px] font-extrabold text-ink" aria-label={`${c.pending_approvals} approvals waiting`}>
                !
              </span>
            ) : unread > 0 ? (
              <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-primary-foreground" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </span>
        </span>
      )}
    </NavLink>
  );
};

export const ConversationListSkeleton: FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-1 px-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-1.5">
        <Skeleton className="h-10 w-10 rounded-[14px]" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

/** Sidebar sections: FAVOURITES · BOTS (direct chats) · GROUPS. */
export const GroupedConversations: FC<{ conversations: Conversation[]; collapsed?: boolean; onNavigate?: () => void }> = ({ conversations, collapsed, onNavigate }) => {
  const groups = useMemo(() => {
    const fav = conversations.filter((c) => c.me?.is_favourite);
    const rest = conversations.filter((c) => !c.me?.is_favourite);
    return [
      { key: "fav", label: "Favourites", items: fav },
      { key: "bots", label: "Bots", items: rest.filter((c) => c.type === ConversationTypes.DIRECT) },
      { key: "groups", label: "Groups", items: rest.filter((c) => c.type !== ConversationTypes.DIRECT) },
    ].filter((g) => g.items.length);
  }, [conversations]);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          {!collapsed && <div className="eyebrow mb-1 px-3">{g.label}</div>}
          <div className="space-y-0.5 px-1.5">
            {g.items.map((c) => (
              <ConversationRow key={c.id} c={c} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
