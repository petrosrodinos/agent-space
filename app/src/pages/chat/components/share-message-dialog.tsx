import { type FC } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { useConversations, useForwardMessage } from "@/features/conversations/hooks/use-conversations";
import { type Message } from "@/features/conversations/interfaces/conversations.interfaces";
import { toast } from "@/hooks/use-toast";

interface Props {
  message: Message | null;
  onClose: () => void;
}

/** Pick a conversation to forward a message (bot or user) into. It appears there as a forwarded message; bots in it don't reply. */
export const ShareMessageDialog: FC<Props> = ({ message, onClose }) => {
  const { data: conversations, isLoading } = useConversations();
  const forward = useForwardMessage();
  const targets = (conversations ?? []).filter((c) => c.id !== message?.conversation_id);

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Forward to…</DialogTitle>
          <DialogDescription>It shows up as a forwarded message. Bots in that conversation won&apos;t reply to it.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search conversations…" />
          <CommandList className="max-h-72">
            {isLoading ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>{targets.length ? "No conversation matches." : "You have no other conversations yet."}</CommandEmpty>
                <CommandGroup>
                  {targets.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.id}`}
                      disabled={forward.isPending}
                      onSelect={() =>
                        message &&
                        forward.mutate(
                          { id: message.id, conversationId: c.id },
                          {
                            onSuccess: () => {
                              toast({ title: `Forwarded to ${c.name}`, duration: 1800 });
                              onClose();
                            },
                          },
                        )
                      }
                      className="gap-2.5"
                    >
                      <BotAvatar seed={c.avatar_seed ?? c.bots[0]?.avatar_seed ?? c.id} color={c.color} size={24} />
                      <span className="truncate font-semibold">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
