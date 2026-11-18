import { useState, type FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, EyeOff, Plus, Search, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useConversations, useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import { useMe } from "@/features/users/hooks/use-users";
import { ConversationListSkeleton, GroupedConversations } from "@/components/layout/conversation-list";
import { useUiStore } from "@/stores/ui";
import { Routes } from "@/routes/routes";
import { NewGroupDialog } from "./components/new-group-dialog";

/** New chat / home. On phones this is also the conversation list (one screen at a time, DESIGN.MD). */
const ChatHomePage: FC = () => {
  const { data: me } = useMe();
  const { data: bots, isPending } = useBots();
  const { data: conversations, isPending: convPending } = useConversations();
  const openDirect = useOpenDirect();
  const navigate = useNavigate();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [groupOpen, setGroupOpen] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const firstName = me?.user.name?.split(" ")[0];

  const start = (botId: string) => openDirect.mutate({ bot_id: botId, is_temporary: temporary || undefined }, { onSuccess: (c) => navigate(Routes.chat.conversation(c.id)) });

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      {/* Mobile: the chats list */}
      <div className="md:hidden">
        <div className="safe-top sticky top-0 z-10 flex items-center gap-2 bg-canvas/95 px-4 pb-2 pt-4 backdrop-blur">
          <h1 className="flex-1 font-display text-[28px] font-bold text-ink">Chats</h1>
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setCommandOpen(true)} aria-label="Search">
            <Search />
          </Button>
          <Button size="icon" className="h-11 w-11" onClick={() => setGroupOpen(true)} aria-label="New group">
            <Users />
          </Button>
        </div>
        <div className="pb-4">{convPending ? <ConversationListSkeleton /> : conversations?.length ? <GroupedConversations conversations={conversations} /> : null}</div>
      </div>

      <div className="mx-auto w-full max-w-[880px] px-4 pb-10 pt-2 sm:px-8 md:pt-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-[26px] font-bold leading-tight text-ink sm:text-[34px]">
              {firstName ? `Hi ${firstName}! ` : ""}Who do you want to talk to?
            </h2>
            <p className="mt-1 text-[15px] text-muted-foreground">Pick a bot to start a chat, or bring several bots and colleagues into a group.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-hairline bg-surface px-3 text-sm font-semibold text-body" title="Temporary chats aren't saved and don't create memories">
              <EyeOff className="h-4 w-4" /> Temporary
              <Switch checked={temporary} onCheckedChange={setTemporary} aria-label="Temporary chat" />
            </label>
            <Button variant="outline" onClick={() => setGroupOpen(true)} className="hidden md:inline-flex">
              <Users /> New group
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-[20px]" />
            ))}
          </div>
        ) : !bots?.length ? (
          <EmptyState
            title="Your team is a little quiet"
            description="Create your first bot from a template, by describing it, or from scratch."
            action={
              <Button asChild size="lg">
                <Link to={Routes.bots.new}>
                  <Plus /> Create a bot
                </Link>
              </Button>
            }
            stickers={[
              { icon: Briefcase, color: "#FF7A3D" },
              { icon: UserRound, color: "#6B4EFF" },
              { icon: Search, color: "#38B6FF" },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => start(b.id)}
                disabled={openDirect.isPending}
                className="card-lift flex min-h-[92px] items-center gap-3 rounded-[20px] border border-hairline bg-surface p-4 text-left shadow-sticker disabled:opacity-60"
              >
                <BotAvatar emoji={b.emoji} color={b.color} size={56} name={b.name} />
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-bold text-ink">{b.name}</span>
                  <span className="line-clamp-2 text-[13px] text-muted-foreground">{b.description ?? b.model?.name}</span>
                </span>
              </button>
            ))}
            <Link to={Routes.bots.new} className="flex min-h-[92px] items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-hairline-strong p-4 text-[15px] font-bold text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="h-5 w-5" /> Create a bot
            </Link>
          </div>
        )}
      </div>
      <NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />
    </div>
  );
};

export default ChatHomePage;
