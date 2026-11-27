import { useEffect, useState, type FC } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKnowledgeItem, useUpdateKnowledge } from "@/features/knowledge/hooks/use-knowledge";
import { KnowledgeKinds, KnowledgeStatuses } from "@/features/knowledge/interfaces/knowledge.interfaces";

const DESCRIPTIONS = {
  [KnowledgeKinds.TEXT]: "Change the title or the note.",
  [KnowledgeKinds.LINK]: "Change the title, the page address, or the text the bot reads from it.",
  [KnowledgeKinds.FILE]: "Change the title or the text the bot reads from this file. The original file is not modified.",
} as const;

interface KnowledgeEditDialogProps {
  /** The item being edited; null closes the dialog. */
  itemId: string | null;
  botId: string | null;
  onClose: () => void;
}

/** Edit everything a bot reads for one knowledge item: title, page address (web pages) and the full text. */
export const KnowledgeEditDialog: FC<KnowledgeEditDialogProps> = ({ itemId, botId, onClose }) => {
  const { data: item, isPending } = useKnowledgeItem(itemId);
  const update = useUpdateKnowledge(botId);
  const [form, setForm] = useState({ title: "", url: "", content: "" });

  useEffect(() => {
    if (item) setForm({ title: item.title, url: item.url ?? "", content: item.content ?? "" });
  }, [item]);

  const isLink = item?.kind === KnowledgeKinds.LINK;
  const isText = item?.kind === KnowledgeKinds.TEXT;
  const urlChanged = isLink && form.url.trim() !== (item?.url ?? "");
  const textChanged = form.content !== (item?.content ?? "");
  const valid = !!form.title.trim() && (!isText || !!form.content.trim()) && (!isLink || /^https?:\/\/\S+\.\S+/.test(form.url.trim()));
  const dirty = !!item && (form.title !== item.title || urlChanged || textChanged);

  const save = () => {
    if (!item) return;
    update.mutate(
      {
        id: item.id,
        title: form.title,
        // A changed address re-reads the page, unless the text was also edited by hand.
        ...(urlChanged ? { url: form.url.trim() } : {}),
        ...(textChanged ? { content: form.content } : {}),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle>Edit knowledge</DialogTitle>
          <DialogDescription>{item ? DESCRIPTIONS[item.kind] : "Loading…"}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2">
          {isPending || !item ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {item.status === KnowledgeStatuses.FAILED && item.status_error && (
                <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {item.status_error}
                </p>
              )}
              {item.status === KnowledgeStatuses.PROCESSING && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Still reading and indexing. The text appears here when it's done.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="k-title">Title</Label>
                <Input id="k-title" value={form.title} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              {isLink && (
                <div className="space-y-1.5">
                  <Label htmlFor="k-url">Page address</Label>
                  <Input id="k-url" type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
                  {urlChanged && !textChanged && <p className="text-xs text-muted-foreground">Saving re-reads the page from the new address.</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="k-content">{isText ? "Note" : "Text the bot reads"}</Label>
                  <span className="text-xs text-muted-foreground">{form.content.length.toLocaleString()} characters</span>
                </div>
                <Textarea dictation
                  id="k-content"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder={isText ? "Facts, FAQs, policies…" : "No text could be read. You can type it here."}
                  className="min-h-[320px] resize-y font-mono text-[13px] leading-relaxed"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-hairline px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={update.isPending} disabled={!item || !valid || !dirty} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
