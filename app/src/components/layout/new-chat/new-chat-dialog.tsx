import { useRef, type FC } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateBotForm } from "@/pages/bots/components/create-bot-form";
import { NewGroupForm } from "@/pages/chat/components/new-group-form";
import { NewChatSteps, useUiStore } from "@/stores/ui";
import { NEW_CHAT_OPTIONS } from "./new-chat-options";
import { NewChatStepLayout } from "./new-chat-step";

/**
 * Two-step "new chat" modal. Step 1 picks what to create (bot or group); step 2 is that form.
 * Opened from anywhere via `useUiStore().openNewChat(step?)`; mounted once in the app shell.
 */
export const NewChatDialog: FC = () => {
  const step = useUiStore((s) => s.new_chat_step);
  const entry = useUiStore((s) => s.new_chat_entry);
  const setStep = useUiStore((s) => s.setNewChatStep);
  const close = useUiStore((s) => s.closeNewChat);
  const closeRef = useRef<(() => void) | null>(null);

  const onBack = entry === NewChatSteps.CHOOSE ? () => setStep(NewChatSteps.CHOOSE) : undefined;
  const requestClose = () => (step === NewChatSteps.CHOOSE || !closeRef.current ? close() : closeRef.current());

  return (
    <Dialog open={!!step} onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px] sm:p-0">
        {step === NewChatSteps.CHOOSE && (
          <NewChatStepLayout title="Start something new" description="Create a bot to talk to, or a group where bots and colleagues meet.">
            <div className="space-y-3">
              {NEW_CHAT_OPTIONS.map(({ step: target, label, description, icon: Icon, color }) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setStep(target)}
                  className="card-lift group flex w-full items-center gap-4 rounded-[20px] border border-hairline bg-surface p-4 text-left shadow-sticker transition-colors hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-white" style={{ backgroundColor: color }}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-ink">{label}</span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </NewChatStepLayout>
        )}
        {step === NewChatSteps.BOT && <CreateBotForm onDone={close} onBack={onBack} closeRef={closeRef} />}
        {step === NewChatSteps.GROUP && <NewGroupForm onDone={close} onBack={onBack} closeRef={closeRef} />}
      </DialogContent>
    </Dialog>
  );
};
