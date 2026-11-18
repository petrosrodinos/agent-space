import { useRef, useState, type FC } from "react";
import { CheckCircle2, MonitorPlay, MousePointerClick, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComputerViewer } from "@/components/layout/computer-viewer";
import { handBack } from "@/features/computers/services/computers.services";
import { provideRunInput } from "@/features/tasks/services/tasks.services";
import type { MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";
import { toast } from "@/hooks/use-toast";
import { MessagePartTypes, ComputerHandoffStatuses, ComputerHandoffKinds } from "@/features/conversations/interfaces/conversations.interfaces";
import { ComputerHandoffKindOptions } from "@/config/constants/dropdowns/computers/computer.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ComputerViewModes } from "@/features/computers/interfaces/computers.interfaces";

type HandoffPart = Extract<MessagePart, { type: typeof MessagePartTypes.COMPUTER_HANDOFF }>;
type Finish = typeof ComputerHandoffStatuses.DONE | typeof ComputerHandoffStatuses.CANCELLED;


/**
 * §9.2/§9.4 — the bot asks the user to take control of its cloud computer (sign in, two-step code, captcha).
 * What the user types goes straight to the website on the computer; it never reaches the bot or the chat.
 */
export const ComputerHandoffCard: FC<{ part: HandoffPart; runId: string | null; canAct: boolean; botName: string }> = ({ part, runId, canAct, botName }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Finish | null>(null);
  const sent = useRef(false);

  const finish = async (status: Finish) => {
    if (!runId || sent.current) return;
    sent.current = true;
    setBusy(status);
    try {
      await handBack(part.bot_id).catch(() => undefined);
      await provideRunInput(runId, { request_id: part.request_id, result: { status } });
      setOpen(false);
    } catch (e) {
      sent.current = false;
      toast({ title: "Could not tell the bot", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (part.status !== ComputerHandoffStatuses.WAITING) {
    return (
      <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        {part.status === ComputerHandoffStatuses.DONE ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4" />}
        {part.status === ComputerHandoffStatuses.DONE ? "You handed the computer back" : "Skipped taking control"}
      </p>
    );
  }

  return (
    <section className="my-2 rounded-lg border-[1.5px] border-primary/40 bg-surface p-4 shadow-sticker-strong sm:p-5" aria-label="Take control of the cloud computer">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
          <MonitorPlay className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{getDropdownOptionLabel(ComputerHandoffKindOptions, part.kind, getDropdownOptionLabel(ComputerHandoffKindOptions, ComputerHandoffKinds.OTHER))}</p>
          <p className="text-sm text-body">{part.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">Agent Space never stores website passwords. What you type goes straight to the website on {botName}'s computer.</p>
        </div>
      </div>
      {canAct ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={() => setOpen(true)}>
            <MousePointerClick /> Take control
          </Button>
          <Button variant="outline" loading={busy === ComputerHandoffStatuses.DONE} onClick={() => void finish(ComputerHandoffStatuses.DONE)}>
            <CheckCircle2 /> I'm done — hand back
          </Button>
          <Button variant="ghost" loading={busy === ComputerHandoffStatuses.CANCELLED} onClick={() => void finish(ComputerHandoffStatuses.CANCELLED)}>
            I can't do this
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Waiting for the person who asked to take control…</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-3 rounded-none p-3 sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-xl sm:p-5">
          <DialogHeader>
            <DialogTitle>{botName}'s computer</DialogTitle>
            <DialogDescription>{part.reason}</DialogDescription>
          </DialogHeader>
          <ComputerViewer botId={part.bot_id} initialMode={ComputerViewModes.CONTROL} className="min-h-0 flex-1" onHandedBack={() => void finish(ComputerHandoffStatuses.DONE)} />
          <div className="flex justify-end">
            <Button loading={busy === ComputerHandoffStatuses.DONE} onClick={() => void finish(ComputerHandoffStatuses.DONE)}>
              <CheckCircle2 /> I'm done — hand back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
