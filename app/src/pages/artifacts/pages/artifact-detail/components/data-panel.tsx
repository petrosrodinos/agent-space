import { useMemo, useState, type FC } from "react";
import { Download, Lock, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useArtifactRecords, useDeleteRecord } from "@/features/artifacts/hooks/use-artifacts";
import type { Artifact, ArtifactFileRef } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { getUploadUrl } from "@/features/artifacts/services/artifacts.services";
import { formatBytes, formatDateTime } from "@/lib/date";
import { toast } from "@/hooks/use-toast";
import { platform } from "@/platform";
import { ALL_FILTER } from "@/config/constants/filters";

const isFileRef = (v: unknown): v is ArtifactFileRef => !!v && typeof v === "object" && (v as ArtifactFileRef).type === "file" && typeof (v as ArtifactFileRef).id === "string";
const cell = (v: unknown) => (v === null || v === undefined ? "" : isFileRef(v) ? v.filename : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Visitor uploads download through a short-lived signed link (owners and editors only). */
const FileLink: FC<{ artifactId: string; file: { id: string; filename: string; size: number } }> = ({ artifactId, file }) => {
  const open = async () => {
    try {
      const { url, filename } = await getUploadUrl(artifactId, file.id);
      platform.files.download(url, filename);
    } catch (e) {
      toast({ title: "Could not download", description: (e as Error).message, variant: "error" });
    }
  };
  return (
    <button type="button" onClick={() => void open()} className="inline-flex max-w-full items-center gap-1 rounded-md text-left font-semibold text-primary underline-offset-2 hover:underline">
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{file.filename}</span>
      <span className="shrink-0 text-xs font-normal text-muted-foreground">{formatBytes(file.size)}</span>
    </button>
  );
};

/** Information the artifact stored — form responses, votes, tracker items (§7.5 Save information). Owners/Editors only. */
export const DataPanel: FC<{ artifact: Artifact }> = ({ artifact: a }) => {
  const [collection, setCollection] = useState<string>(ALL_FILTER);
  const { data, isPending } = useArtifactRecords(a.id, collection === ALL_FILTER ? undefined : collection);
  const del = useDeleteRecord();
  const columns = useMemo(() => [...new Set((data?.records ?? []).flatMap((r) => Object.keys(r.data ?? {})))].slice(0, 12), [data]);

  const exportCsv = () => {
    const rows = data?.records ?? [];
    const head = ["collection", "submitted_by", "created_at", ...columns];
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const csv = [head, ...rows.map((r) => [r.collection, r.submitted_by?.email ?? "visitor", r.created_at, ...columns.map((c) => cell(r.data?.[c]))])].map((line) => line.map((x) => esc(String(x))).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    platform.files.download(url, `${a.slug}-entries.csv`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  if (isPending) return <Skeleton className="h-60 rounded-lg" />;
  if (!data?.collections.length && !data?.files?.length)
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nothing stored yet. When visitors fill in a form, vote or add items, their entries appear here. Ask a bot to summarise them any time.</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={collection} onValueChange={setCollection}>
          <SelectTrigger className="min-w-0 flex-1" aria-label="Collection">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entries</SelectItem>
            {data.collections.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} aria-label="Download as CSV">
          <Download /> CSV
        </Button>
      </div>
      <ul className="space-y-2">
        {data.records.map((r) => (
          <li key={r.id} className="rounded-md border border-hairline p-3">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 font-semibold">
                {r.collection.startsWith("private_") && <Lock className="h-3 w-3" />}
                {r.collection}
              </span>
              <span className="truncate">{r.submitted_by ? (r.submitted_by.name ?? r.submitted_by.email) : "Visitor"}</span>
              <span className="ml-auto shrink-0">{formatDateTime(r.created_at)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete entry" onClick={() => del.mutate({ id: a.id, recordId: r.id })}>
                <Trash2 className="!h-3.5 !w-3.5" />
              </Button>
            </div>
            <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-0.5 text-sm">
              {Object.entries(r.data ?? {})
                .slice(0, 12)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="truncate font-semibold text-muted-foreground">{k}</dt>
                    <dd className="break-words text-ink">{isFileRef(v) ? <FileLink artifactId={a.id} file={v} /> : cell(v)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
      {!!data.files?.length && (
        <section className="rounded-md border border-hairline p-3" aria-label="Uploaded files">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Uploaded files ({data.files.length})</h3>
          <ul className="space-y-1.5 text-sm">
            {data.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <FileLink artifactId={a.id} file={f} />
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{f.is_visitor ? "Visitor" : "Member"} · {formatDateTime(f.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
