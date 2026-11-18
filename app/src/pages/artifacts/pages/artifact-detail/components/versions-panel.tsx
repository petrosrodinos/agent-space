import { useState, type FC } from "react";
import { Eye, GitCompare, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { useArtifactVersions, useLabelVersion, useRestoreVersion } from "@/features/artifacts/hooks/use-artifacts";
import type { Artifact, ArtifactVersion } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

interface Props {
  artifact: Artifact;
  previewId: string | null;
  compareId: string | null;
  onPreview: (v: ArtifactVersion | null) => void;
  onCompare: (v: ArtifactVersion | null) => void;
}

/** Version history (§7.5 Versions): preview, compare side by side, name and restore. */
export const VersionsPanel: FC<Props> = ({ artifact: a, previewId, compareId, onPreview, onCompare }) => {
  const { data, isPending } = useArtifactVersions(a.id);
  const label = useLabelVersion();
  const restore = useRestoreVersion();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  if (isPending) return <Skeleton className="h-60 rounded-[18px]" />;
  return (
    <div className="space-y-2">
      {(previewId || compareId) && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onPreview(null);
            onCompare(null);
          }}
        >
          Back to the live version
        </Button>
      )}
      <ul className="space-y-2">
        {(data ?? []).map((v) => (
          <li key={v.id} className={cn("rounded-[16px] border p-3", previewId === v.id ? "border-primary bg-primary-soft" : "border-hairline")}>
            <div className="flex items-start gap-2.5">
              {v.bot ? <BotAvatar emoji={v.bot.emoji} color={v.bot.color} size={32} /> : <PersonAvatar name={v.created_by?.name} email={v.created_by?.email} size={32} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-ink">Version {v.version}</span>
                  {v.is_current && <Badge variant="success">Live</Badge>}
                  {v.is_draft && <Badge variant="outline">Draft</Badge>}
                  {v.label && <Badge variant="secondary">{v.label}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {v.bot ? `${v.bot.name} for ${v.created_by?.name ?? v.created_by?.email ?? "someone"}` : (v.created_by?.name ?? v.created_by?.email ?? "Someone")} · {formatDateTime(v.created_at)}
                </p>
                {v.change_summary && <p className="mt-1 text-sm text-body">{v.change_summary}</p>}
              </div>
            </div>
            {editing?.id === v.id ? (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  label.mutate({ id: a.id, versionId: v.id, label: editing.value.trim() || null }, { onSuccess: () => setEditing(null) });
                }}
              >
                <Input autoFocus value={editing.value} maxLength={80} placeholder="e.g. Sent to client" onChange={(e) => setEditing({ id: v.id, value: e.target.value })} aria-label="Version name" />
                <Button type="submit" size="sm" loading={label.isPending}>
                  Save
                </Button>
              </form>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => onPreview(previewId === v.id ? null : v)}>
                  <Eye /> {previewId === v.id ? "Previewing" : "Preview"}
                </Button>
                {!v.is_current && (
                  <Button variant="ghost" size="sm" onClick={() => onCompare(compareId === v.id ? null : v)}>
                    <GitCompare /> {compareId === v.id ? "Comparing" : "Compare"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditing({ id: v.id, value: v.label ?? "" })}>
                  <Pencil /> Name
                </Button>
                {!v.is_current && !v.is_draft && (
                  <Button variant="ghost" size="sm" loading={restore.isPending && restore.variables?.versionId === v.id} onClick={() => restore.mutate({ id: a.id, versionId: v.id })}>
                    <RotateCcw /> Restore
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
