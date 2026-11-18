import { useState, type FC } from "react";
import { Maximize2, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { useInteract } from "@/features/conversations/hooks/use-conversations";
import type { UiBlock } from "@/features/conversations/interfaces/conversations.interfaces";
import { toast } from "@/hooks/use-toast";
import { UiBlockView } from "./ui-blocks";

interface Props {
  messageId: string;
  part: { id: string; title: string; blocks: UiBlock[]; fallback_text: string };
}

/** §7.4 interactive reply frame: header with title + "full screen" + "show as text"; input goes back to the bot. */
export const InteractiveReply: FC<Props> = ({ messageId, part }) => {
  const [asText, setAsText] = useState(false);
  const [full, setFull] = useState(false);
  const interact = useInteract();
  const onAction = (componentId: string, payload: Record<string, unknown>) =>
    interact.mutate({ id: messageId, component_id: componentId, payload }, { onSuccess: () => toast({ title: "Sent to the bot", duration: 1500 }) });

  const body = asText ? (
    <Markdown>{part.fallback_text || "(No text version)"}</Markdown>
  ) : (
    <div className="space-y-3">
      {part.blocks.map((b, i) => (
        <UiBlockView key={i} block={b} onAction={onAction} disabled={interact.isPending} />
      ))}
    </div>
  );

  return (
    <section className="my-2 animate-pop-in rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker sm:p-5" aria-label={part.title || "Interactive reply"}>
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{part.title || "Interactive reply"}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAsText((v) => !v)} aria-label={asText ? "Show interactive version" : "Show as text"} title={asText ? "Interactive" : "Show as text"}>
          {asText ? <Sparkles /> : <Type />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFull(true)} aria-label="Open full screen">
          <Maximize2 />
        </Button>
      </header>
      {body}
      <Dialog open={full} onOpenChange={setFull} closeOnOutsideClick>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{part.title || "Interactive reply"}</DialogTitle>
            <DialogDescription className="sr-only">Full-screen view</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    </section>
  );
};
