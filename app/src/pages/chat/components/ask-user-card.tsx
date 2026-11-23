import { useRef, useState, type FC } from "react";
import { CheckCircle2, HelpCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { provideRunInput } from "@/features/tasks/services/tasks.services";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth";
import { AskUserStatuses, MessagePartTypes, type MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";

type AskPart = Extract<MessagePart, { type: typeof MessagePartTypes.ASK_USER }>;

/** The bot paused to ask a clarifying question. Tapping a choice (or sending text) resumes the run with that answer. */
export const AskUserCard: FC<{ part: AskPart }> = ({ part }) => {
  const me = useAuthStore((s) => s.user);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  const send = async (answer: string | null) => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    try {
      await provideRunInput(part.run_id, { request_id: part.request_id, result: answer ? { status: AskUserStatuses.ANSWERED, answer } : { status: AskUserStatuses.SKIPPED } });
    } catch (e) {
      sent.current = false;
      toast({ title: "Could not send your answer", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (part.status === AskUserStatuses.ANSWERED) {
    return (
      <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" /> {part.question} <strong className="text-ink">{part.answer}</strong>
      </p>
    );
  }
  if (part.status === AskUserStatuses.SKIPPED) return <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><HelpCircle className="h-4 w-4" /> Question skipped.</p>;
  if (part.for_user_id !== me?.id) return <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><HelpCircle className="h-4 w-4" /> Waiting for {part.for_user_name} to answer…</p>;

  return (
    <section className="my-2 rounded-lg border-[1.5px] border-primary/40 bg-surface p-4 shadow-sticker-strong sm:p-5" aria-label="Question from the bot">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
          <HelpCircle className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 pt-2 font-bold text-ink">{part.question}</p>
      </div>
      {part.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {part.options.map((o) => (
            <Button key={o} variant="outline" size="sm" disabled={busy} onClick={() => void send(o)}>
              {o}
            </Button>
          ))}
        </div>
      )}
      {part.allow_free_text && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void send(text.trim());
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your own answer" aria-label="Your answer" maxLength={2000} />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send answer">
            <Send />
          </Button>
        </form>
      )}
      <Button variant="ghost" size="sm" className="mt-2" disabled={busy} onClick={() => void send(null)}>
        Skip, let the bot decide
      </Button>
    </section>
  );
};
