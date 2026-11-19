import { useState, type FC } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteMemory, useUpdateMemory } from "@/features/bots/hooks/use-bots";
import type { Memory } from "@/features/bots/interfaces/bots.interfaces";
import { timeAgo } from "@/lib/date";

interface MemoryListProps<T extends Memory> {
  memories: T[] | undefined;
  isPending: boolean;
  emptyText: string;
  /** Extra context shown before the timestamp, e.g. the bot that remembers it. */
  meta?: (m: T) => string | null;
}

/** View, edit and delete a list of memories (Settings → Memory). */
export const MemoryList = <T extends Memory>({ memories, isPending, emptyText, meta }: MemoryListProps<T>) => {
  const update = useUpdateMemory();
  const remove = useDeleteMemory();
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);

  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (!memories?.length) return <p className="py-3 text-sm text-muted-foreground">{emptyText}</p>;

  const save = () => {
    if (!editing?.content.trim()) return;
    update.mutate({ id: editing.id, content: editing.content.trim() }, { onSuccess: () => setEditing(null) });
  };

  return (
    <ul className="divide-y divide-hairline">
      {memories.map((m) => (
        <li key={m.id} className="flex items-start gap-2 py-3">
          {editing?.id === m.id ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Input
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  aria-label="Memory"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={update.isPending} disabled={!editing.content.trim()} onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <MemoryRow memory={m} meta={meta?.(m) ?? null} onEdit={() => setEditing({ id: m.id, content: m.content })} onDelete={() => remove.mutate(m.id)} deleting={remove.isPending && remove.variables === m.id} />
          )}
        </li>
      ))}
    </ul>
  );
};

const MemoryRow: FC<{ memory: Memory; meta: string | null; onEdit: () => void; onDelete: () => void; deleting: boolean }> = ({ memory, meta, onEdit, onDelete, deleting }) => (
  <>
    <div className="min-w-0 flex-1">
      <p className="break-words text-[15px] text-ink">{memory.content}</p>
      <p className="text-xs text-muted-foreground">{[meta, timeAgo(memory.updated_at)].filter(Boolean).join(" · ")}</p>
    </div>
    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onEdit} aria-label="Edit memory">
      <Pencil />
    </Button>
    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onDelete} disabled={deleting} aria-label="Delete memory">
      <Trash2 />
    </Button>
  </>
);
