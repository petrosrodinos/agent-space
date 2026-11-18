import { useState, type FC } from "react";
import { FileText, Globe, Loader2, NotebookPen, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard } from "@/components/ui/setting-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAddKnowledge, useDeleteKnowledge, useKnowledge, useUpdateKnowledge } from "@/features/knowledge/hooks/use-knowledge";
import type { KnowledgeItem, KnowledgeKind } from "@/features/knowledge/interfaces/knowledge.interfaces";
import { uploadFile } from "@/features/files/services/files.services";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { formatBytes, timeAgo } from "@/lib/date";
import { KnowledgeKinds } from "@/features/knowledge/interfaces/knowledge.interfaces";

const KIND_ICON: Record<KnowledgeKind, typeof FileText> = { FILE: FileText, LINK: Globe, TEXT: NotebookPen };
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html";

/**
 * Knowledge for one bot (§6.2) or the organisation library (botId = null): files, web pages and notes the bot reads
 * with search_knowledge / read_knowledge.
 */
export const KnowledgePanel: FC<{ botId: string | null; canEdit: boolean; title?: string; description?: string }> = ({ botId, canEdit, title = "Knowledge", description }) => {
  const { data, isPending } = useKnowledge(botId);
  const add = useAddKnowledge(botId);
  const update = useUpdateKnowledge(botId);
  const remove = useDeleteKnowledge(botId);
  const [mode, setMode] = useState<KnowledgeKind>(KnowledgeKinds.FILE);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState({ title: "", content: "" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<KnowledgeItem | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; content: string; kind: KnowledgeKind } | null>(null);

  const pickFiles = async () => {
    const files = await platform.files.pick({ multiple: true, accept: ACCEPT });
    for (const file of files.slice(0, 10)) {
      setUploading(file.name);
      try {
        const stored = await uploadFile(file, "knowledge", { bot_id: botId ?? undefined });
        await add.mutateAsync({ kind: KnowledgeKinds.FILE, file_id: stored.id });
      } catch (e) {
        toast({ title: `Could not add ${file.name}`, description: (e as Error).message, variant: "error" });
      }
    }
    setUploading(null);
  };

  return (
    <SettingsCard title={title} description={description ?? "Files, web pages and notes this bot can search and read when answering. PDF, Word, text, Markdown and CSV are read in full."}>
      {canEdit && (
        <div className="space-y-3 border-b border-hairline pb-4">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { id: KnowledgeKinds.FILE, label: "Files" },
              { id: KnowledgeKinds.LINK, label: "Web page" },
              { id: KnowledgeKinds.TEXT, label: "Note" },
            ]}
            ariaLabel="What to add"
          />
          {mode === KnowledgeKinds.FILE && (
            <Button variant="outline" onClick={pickFiles} disabled={!!uploading} className="w-full sm:w-auto">
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? `Adding ${uploading}…` : "Upload files"}
            </Button>
          )}
          {mode === KnowledgeKinds.LINK && (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^https?:\/\/\S+\.\S+/.test(url)) add.mutate({ kind: KnowledgeKinds.LINK, url }, { onSuccess: () => setUrl("") });
              }}
            >
              <Input type="url" placeholder="https://example.com/pricing" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Web page address" />
              <Button type="submit" disabled={!/^https?:\/\/\S+\.\S+/.test(url)} loading={add.isPending}>
                Add page
              </Button>
            </form>
          )}
          {mode === KnowledgeKinds.TEXT && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.content.trim()) add.mutate({ kind: KnowledgeKinds.TEXT, title: note.title || undefined, content: note.content }, { onSuccess: () => setNote({ title: "", content: "" }) });
              }}
            >
              <Input placeholder="Title (e.g. Refund policy)" value={note.title} onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))} maxLength={200} aria-label="Note title" />
              <Textarea rows={4} placeholder="Facts, FAQs, policies…" value={note.content} onChange={(e) => setNote((n) => ({ ...n, content: e.target.value }))} aria-label="Note" />
              <Button type="submit" disabled={!note.content.trim()} loading={add.isPending}>
                Add note
              </Button>
            </form>
          )}
        </div>
      )}

      {isPending ? (
        <div className="space-y-2 pt-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !data?.length ? (
        <p className="py-4 text-sm text-muted-foreground">Nothing here yet.{canEdit ? " Add files, pages or notes above." : ""}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((k) => {
            const Icon = KIND_ICON[k.kind];
            return (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{k.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {k.kind === KnowledgeKinds.FILE && k.file ? `${formatBytes(k.file.size)} · ` : ""}
                    {k.kind === KnowledgeKinds.LINK && k.url ? `${k.url} · ` : ""}
                    {k.readable ? `${Math.max(1, Math.round(k.characters / 1000))}k characters` : "Couldn't read the text"} · {timeAgo(k.created_at)}
                  </span>
                </span>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${k.title}`} onClick={() => setEditing({ id: k.id, title: k.title, content: k.content ?? "", kind: k.kind })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Remove ${k.title}`} onClick={() => setRemoving(k)}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit knowledge</DialogTitle>
            <DialogDescription>{editing?.kind === KnowledgeKinds.TEXT ? "Change the title or the note." : "Change how this item is named."}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="k-title">Title</Label>
                <Input id="k-title" value={editing.title} maxLength={200} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              {editing.kind === KnowledgeKinds.TEXT && (
                <div className="space-y-1.5">
                  <Label htmlFor="k-content">Note</Label>
                  <Textarea id="k-content" rows={8} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              disabled={!editing?.title.trim()}
              onClick={() => editing && update.mutate({ id: editing.id, title: editing.title, ...(editing.kind === KnowledgeKinds.TEXT ? { content: editing.content } : {}) }, { onSuccess: () => setEditing(null) })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.title}?`}
        description="The bot will stop using it. It can be restored for 30 days."
        confirmText="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </SettingsCard>
  );
};
