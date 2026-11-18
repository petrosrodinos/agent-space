import type { FC } from "react";
import { Link } from "react-router-dom";
import { Bot, LayoutGrid, MessageCircle, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircleButton } from "@/components/ui/circle-button";
import { PersonAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useConversations } from "@/features/conversations/hooks/use-conversations";
import { useMe } from "@/features/users/hooks/use-users";
import { ConversationInbox, ConversationListSkeleton } from "@/components/layout/conversation-list";
import { ChatActions } from "@/components/layout/new-chat/chat-actions";
import { NEW_CHAT_OPTIONS } from "@/components/layout/new-chat/new-chat-options";
import { useWorkspaceLinks } from "@/components/layout/workspace-links";
import { InstallAppBanner } from "@/components/layout/install-app";
import { NewChatSteps, useUiStore } from "@/stores/ui";
import { Routes } from "@/routes/routes";

/**
 * Chats: the conversation inbox, like a messaging app. "+" creates a bot or a group.
 * Mobile (Grok-style): profile avatar (opens Settings) and "+" on top; a floating Tools button and Search pill at the bottom.
 */
const ChatHomePage: FC = () => {
  const { data: conversations, isPending } = useConversations();
  const { data: me } = useMe();
  const openNewChat = useUiStore((s) => s.openNewChat);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const toolsBadge = useWorkspaceLinks().reduce((n, l) => n + (l.badge ?? 0), 0);

  return (
    <div className="relative h-full">
      <div className="scrollbar-thin h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px]">
          {/* Mobile header */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-b from-canvas via-canvas/90 to-transparent px-3 pb-3 pt-[calc(12px+env(safe-area-inset-top))] md:hidden">
            <Link to={Routes.settings.root} className="rounded-full border border-hairline shadow-sticker" aria-label="Settings">
              <PersonAvatar name={me?.user.name} email={me?.user.email} size={40} className="h-11 w-11" />
            </Link>
            <CircleButton onClick={() => openNewChat()} aria-label="New bot or group">
              <Plus />
            </CircleButton>
          </div>
          <InstallAppBanner className="md:hidden" />
          {/* Desktop / tablet header */}
          <div className="sticky top-0 z-10 hidden items-center gap-2 bg-canvas/95 px-4 pb-2 pt-8 backdrop-blur md:flex">
            <h1 className="flex-1 font-display text-[28px] font-bold text-ink">Chats</h1>
            <ChatActions />
          </div>

          <div className="pb-28 pt-1 md:pb-6">
            {isPending ? (
              <ConversationListSkeleton rows={10} />
            ) : conversations?.length ? (
              <ConversationInbox conversations={conversations} />
            ) : (
              <EmptyState
                title="No chats yet"
                description="Create a bot to talk to, or start a group with bots and colleagues."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {NEW_CHAT_OPTIONS.map(({ step, label, icon: Icon }) => (
                      <Button key={step} variant={step === NewChatSteps.BOT ? "default" : "outline"} onClick={() => openNewChat(step)}>
                        <Icon /> {label}
                      </Button>
                    ))}
                  </div>
                }
                stickers={[
                  { icon: Bot, color: "#6B4EFF" },
                  { icon: MessageCircle, color: "#FF7A3D" },
                  { icon: Users, color: "#38B6FF" },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom bar: Tools + Search */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-6 md:hidden [&>*]:pointer-events-auto">
        <CircleButton asChild className="relative h-12 w-12" aria-label="Tools">
          <Link to={Routes.tools}>
            <LayoutGrid />
            {toolsBadge > 0 && <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sunshine px-1 text-[11px] font-extrabold text-ink">{toolsBadge}</span>}
          </Link>
        </CircleButton>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-hairline bg-surface-sunken px-4 text-left text-[16px] text-muted-foreground shadow-sticker transition-colors hover:bg-hairline"
        >
          <Search className="h-5 w-5 shrink-0" /> Search
        </button>
      </div>
    </div>
  );
};

export default ChatHomePage;
