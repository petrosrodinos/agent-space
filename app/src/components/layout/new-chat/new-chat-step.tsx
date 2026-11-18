import type { FC, MutableRefObject, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Props every step form of the "new chat" modal receives from `NewChatDialog`. */
export interface NewChatStepProps {
  /** Close the whole modal (after success, or a confirmed cancel). */
  onDone: () => void;
  /** Go back to the chooser. Absent when the modal was opened straight at this step. */
  onBack?: () => void;
  /** The step writes its guarded close handler here so the dialog's X / Esc / overlay go through it. */
  closeRef: MutableRefObject<(() => void) | null>;
}

/** Shared chrome for each step of the "new chat" modal: header (optional Back), scrollable body, optional footer. */
export const NewChatStepLayout: FC<{ title: string; description: string; hideDescription?: boolean; onBack?: () => void; footer?: ReactNode; children: ReactNode }> = ({ title, description, hideDescription, onBack, footer, children }) => (
  <div className="flex min-h-0 flex-col animate-in fade-in-0 slide-in-from-right-3 duration-200 motion-reduce:animate-none">
    <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b border-hairline px-5 py-4 pr-12 text-left">
      {onBack && (
        <Button variant="ghost" size="icon" className="-ml-1 h-8 w-8 shrink-0 rounded-full" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0">
        <DialogTitle className="text-lg">{title}</DialogTitle>
        <DialogDescription className={hideDescription ? "sr-only" : "mt-0.5 text-sm"}>{description}</DialogDescription>
      </div>
    </DialogHeader>
    <div className="scrollbar-thin max-h-[70dvh] overflow-y-auto px-6 py-6">{children}</div>
    {footer && <DialogFooter className="gap-2 border-t border-hairline px-6 py-4">{footer}</DialogFooter>}
  </div>
);
