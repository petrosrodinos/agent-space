import { useState, type FC } from "react";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ComputerViewer } from "@/components/layout/computer-viewer";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { cn } from "@/lib/utils";

/** Header button: watch the cloud computer of a bot in this conversation (§9.2). Hidden when no bot has one. */
export const ComputerButton: FC<{ conversation: Conversation }> = ({ conversation }) => {
  const bots = conversation.bots.filter((b) => b.cloud_computer_enabled);
  const [open, setOpen] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  if (!bots.length) return null;
  const current = bots.find((b) => b.id === botId) ?? bots[0];
  return (
    <>
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setOpen(true)} aria-label="Watch the bot's computer">
        <Monitor className="!h-5 !w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto p-4 sm:max-w-[720px]">
          <SheetHeader>
            <SheetTitle>{current.name}'s computer</SheetTitle>
            <SheetDescription>Watch live, or take control to sign in or show the bot something.</SheetDescription>
          </SheetHeader>
          {bots.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Bot">
              {bots.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={b.id === current.id}
                  onClick={() => setBotId(b.id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold", b.id === current.id ? "border-primary bg-primary-soft" : "border-hairline")}
                >
                  <BotAvatar emoji={b.emoji} color={b.color} size={24} /> {b.name}
                </button>
              ))}
            </div>
          )}
          {open && <ComputerViewer key={current.id} botId={current.id} />}
        </SheetContent>
      </Sheet>
    </>
  );
};
