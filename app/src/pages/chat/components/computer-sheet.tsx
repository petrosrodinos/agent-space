import { useState, type FC } from "react";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ComputerViewer } from "@/components/layout/computer-viewer";
import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";
import { cn } from "@/lib/utils";

/** Sheet to watch (and take control of) the cloud computer of one of `bots` (§9.2). */
export const ComputerSheet: FC<{ bots: BotBrief[]; open: boolean; onOpenChange: (v: boolean) => void }> = ({ bots, open, onOpenChange }) => {
  const [botId, setBotId] = useState<string | null>(null);
  const current = bots.find((b) => b.id === botId) ?? bots[0];
  if (!current) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
  );
};
