import type { FC } from "react";
import { Bot, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConversations } from "@/features/conversations/hooks/use-conversations";
import { ConversationListSkeleton, GroupedConversations } from "@/components/layout/conversation-list";
import { ChatActions } from "@/components/layout/new-chat/chat-actions";
import { NEW_CHAT_OPTIONS } from "@/components/layout/new-chat/new-chat-options";
import { NewChatSteps, useUiStore } from "@/stores/ui";

/** Chats: the conversation list, like a messaging app inbox. "+" creates a bot or a group. */
const ChatHomePage: FC = () => {
  const { data: conversations, isPending } = useConversations();
  const openNewChat = useUiStore((s) => s.openNewChat);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="safe-top sticky top-0 z-10 flex items-center gap-2 bg-canvas/95 px-4 pb-2 pt-4 backdrop-blur md:pt-8">
          <h1 className="flex-1 font-display text-[28px] font-bold text-ink">Chats</h1>
          <ChatActions />
        </div>

        <div className="pb-6 pt-1">
          {isPending ? (
            <ConversationListSkeleton rows={10} />
          ) : conversations?.length ? (
            <GroupedConversations conversations={conversations} />
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
  );
};

export default ChatHomePage;
