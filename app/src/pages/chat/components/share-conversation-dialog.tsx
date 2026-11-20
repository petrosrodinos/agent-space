import { useState, type FC } from "react";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConversationShare, useSaveConversationShare, useStopConversationShare } from "@/features/conversations/hooks/use-conversations";
import { ConversationShareModes, type ConversationShareMode } from "@/features/conversations/interfaces/conversations.interfaces";
import { formatDateTime } from "@/lib/date";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: { id: ConversationShareMode; title: string; description: string }[] = [
  { id: ConversationShareModes.SNAPSHOT, title: "Only messages so far", description: "People with the link see the conversation as it is now. Anything sent later stays private." },
  { id: ConversationShareModes.LIVE, title: "Include new messages", description: "People with the link also see new messages as they arrive." },
];

const ModePicker: FC<{ value: ConversationShareMode; onChange: (m: ConversationShareMode) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div role="radiogroup" aria-label="What people with the link can see" className="space-y-2">
    {MODE_OPTIONS.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        disabled={disabled}
        onClick={() => onChange(o.id)}
        className={cn(
          "flex w-full items-start gap-3 rounded-md border-[1.5px] p-3 text-left transition-colors disabled:opacity-60",
          value === o.id ? "border-ink bg-surface" : "border-hairline bg-surface-soft hover:border-hairline-strong",
        )}
      >
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]", value === o.id ? "border-ink bg-ink text-canvas" : "border-hairline-strong")}>
          {value === o.id && <Check className="h-3 w-3" />}
        </span>
        <span>
          <span className="block text-sm font-bold text-ink">{o.title}</span>
          <span className="block text-sm text-muted-foreground">{o.description}</span>
        </span>
      </button>
    ))}
  </div>
);

/** "Share conversation": create a public read-only link, choose whether it shows new messages, copy it or send it through the phone's share sheet. */
export const ShareConversationDialog: FC<{ open: boolean; onOpenChange: (open: boolean) => void; conversationId: string; conversationName: string }> = ({ open, onOpenChange, conversationId, conversationName }) => {
  const { data: share, isPending } = useConversationShare(conversationId, open);
  const save = useSaveConversationShare(conversationId);
  const stop = useStopConversationShare(conversationId);
  const [draftMode, setDraftMode] = useState<ConversationShareMode>(ConversationShareModes.SNAPSHOT);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!share) return;
    await platform.clipboard.writeText(share.url);
    setCopied(true);
    toast({ title: "Link copied", duration: 1500 });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const send = async () => {
    if (!share) return;
    const result = await platform.share.share({ title: conversationName, text: `${conversationName} on Agent Space`, url: share.url });
    if (result === "copied") toast({ title: "Link copied", duration: 1500 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnOutsideClick>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" /> Share conversation
          </DialogTitle>
          <DialogDescription>Anyone with the link can read this conversation, without signing in. They can't write in it.</DialogDescription>
        </DialogHeader>

        {isPending ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : !share ? (
          <div className="space-y-4">
            <ModePicker value={draftMode} onChange={setDraftMode} />
            <Button className="w-full" loading={save.isPending} onClick={() => save.mutate({ mode: draftMode })}>
              <Link2 /> Create link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={share.url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
              <Button variant="outline" size="icon" aria-label="Copy link" onClick={copy}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <Button className="w-full" onClick={send}>
              <Share2 /> Share to…
            </Button>

            <ModePicker value={share.mode} onChange={(mode) => mode !== share.mode && save.mutate({ mode })} disabled={save.isPending} />

            {share.mode === ConversationShareModes.SNAPSHOT && (
              <div className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2">
                <p className="text-sm text-muted-foreground">Shows messages up to {formatDateTime(share.cutoff_at)}.</p>
                <Button variant="ghost" size="sm" loading={save.isPending} onClick={() => save.mutate({ mode: ConversationShareModes.SNAPSHOT, refresh: true })}>
                  <RefreshCw /> Update
                </Button>
              </div>
            )}

            <Button variant="outline" className="w-full text-error" loading={stop.isPending} onClick={() => stop.mutate()}>
              Stop sharing
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
