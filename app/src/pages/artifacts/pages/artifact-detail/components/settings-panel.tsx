import { useEffect, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useArtifactDataGrants, useDeleteArtifact, useRevokeArtifactData, useTransferArtifact, useUpdateArtifact } from "@/features/artifacts/hooks/use-artifacts";
import type { Artifact, ArtifactType } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { ArtifactTypeOptions } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { Routes } from "@/routes/routes";
import { ArtifactRoles } from "@/features/artifacts/interfaces/artifacts.interfaces";

const ConfirmActions = { DELETE: "delete", TRANSFER: "transfer" } as const;
type ConfirmAction = (typeof ConfirmActions)[keyof typeof ConfirmActions];

/** Connected services this viewer allowed the artifact to read live (§7.5). Only the viewer's own permissions. */
const LiveDataAccess: FC<{ artifactId: string }> = ({ artifactId }) => {
  const { data } = useArtifactDataGrants(artifactId);
  const revoke = useRevokeArtifactData();
  if (!data?.length) return null;
  return (
    <section className="space-y-2" aria-label="Live data access">
      <h3 className="text-sm font-bold text-ink">Live data access</h3>
      <p className="text-xs text-muted-foreground">This artifact can read these accounts of yours. Others who open it use their own.</p>
      <ul className="space-y-1.5">
        {data.map((g) => (
          <li key={g.service} className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2 text-sm">
            <span className="font-semibold text-ink">{g.service_name}</span>
            <Button variant="outline" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate({ id: artifactId, service: g.service })}>Remove</Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Title, type, link, "Review before publishing", ownership and deletion (§7.5). */
export const SettingsPanel: FC<{ artifact: Artifact }> = ({ artifact: a }) => {
  const navigate = useNavigate();
  const update = useUpdateArtifact();
  const del = useDeleteArtifact();
  const transfer = useTransferArtifact();
  const { data: members } = useMembers();
  const isOwner = a.role === ArtifactRoles.OWNER;
  const canEdit = isOwner || a.role === ArtifactRoles.EDITOR;
  const [title, setTitle] = useState(a.title);
  const [description, setDescription] = useState(a.description ?? "");
  const [type, setType] = useState<ArtifactType>(a.type);
  const [slug, setSlug] = useState(a.slug);
  const [newOwner, setNewOwner] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    setTitle(a.title);
    setDescription(a.description ?? "");
    setType(a.type);
    setSlug(a.slug);
  }, [a]);

  const dirty = title.trim() !== a.title || description.trim() !== (a.description ?? "") || type !== a.type || (isOwner && slug !== a.slug);
  const base = a.url.slice(0, a.url.length - a.slug.length);

  return (
    <div className="space-y-6">
      <LiveDataAccess artifactId={a.id} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: a.id, title: title.trim(), description: description.trim(), type, ...(isOwner && slug !== a.slug ? { slug } : {}) });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="artifact-title">Title</Label>
          <Input id="artifact-title" value={title} maxLength={120} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="artifact-description">Description</Label>
          <Textarea dictation id="artifact-description" value={description} maxLength={500} rows={2} disabled={!canEdit} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ArtifactType)} disabled={!canEdit}>
            <SelectTrigger aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ArtifactTypeOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <o.icon className="h-4 w-4 shrink-0" />
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="artifact-slug">Link</Label>
          <div className="flex items-center overflow-hidden rounded-md border-[1.5px] border-hairline-strong bg-surface focus-within:border-primary">
            <span className="hidden max-w-[45%] truncate pl-3 text-xs text-muted-foreground sm:block">{base}</span>
            <input
              id="artifact-slug"
              value={slug}
              disabled={!isOwner}
              maxLength={60}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"))}
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none disabled:opacity-60"
            />
          </div>
          <p className="text-xs text-muted-foreground">The link stays the same across versions.</p>
        </div>
        {canEdit && (
          <Button type="submit" className="w-full" disabled={!dirty || !title.trim() || slug.length < 2} loading={update.isPending}>
            Save
          </Button>
        )}
      </form>

      {isOwner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline p-3">
          <div>
            <p className="text-sm font-bold text-ink">Review before publishing</p>
            <p className="text-xs text-muted-foreground">Edits are saved as a draft and go live when an editor clicks Publish.</p>
          </div>
          <Switch checked={a.review_before_publish} onCheckedChange={(v) => update.mutate({ id: a.id, review_before_publish: v })} aria-label="Review before publishing" />
        </div>
      )}

      {isOwner && (
        <div className="space-y-2">
          <p className="eyebrow">Transfer ownership</p>
          <div className="flex gap-2">
            <Select value={newOwner} onValueChange={setNewOwner}>
              <SelectTrigger className="min-w-0 flex-1" aria-label="New owner">
                <SelectValue placeholder="Choose a member…" />
              </SelectTrigger>
              <SelectContent>
                {(members ?? [])
                  .filter((m) => m.user.id !== a.owner?.id)
                  .map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!newOwner} onClick={() => setConfirm(ConfirmActions.TRANSFER)}>
              Transfer
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <Button variant="outline" className="w-full text-error" onClick={() => setConfirm(ConfirmActions.DELETE)}>
          <Trash2 /> Delete artifact
        </Button>
      )}

      <ConfirmationDialog
        isOpen={confirm === ConfirmActions.DELETE}
        onClose={() => setConfirm(null)}
        title={`Delete “${a.title}”?`}
        description="Its link stops working right away. You can restore it from the Deleted tab on the Artifacts page."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(a.id, { onSuccess: () => navigate(Routes.artifacts.root) })}
      />
      <ConfirmationDialog
        isOpen={confirm === ConfirmActions.TRANSFER}
        onClose={() => setConfirm(null)}
        title="Transfer ownership?"
        description={`${members?.find((m) => m.user.id === newOwner)?.user.name ?? "They"} will own this artifact. You'll stay on as an editor.`}
        confirmText="Transfer"
        isLoading={transfer.isPending}
        onConfirm={() => transfer.mutate({ id: a.id, user_id: newOwner }, { onSuccess: () => (setConfirm(null), setNewOwner("")) })}
      />
    </div>
  );
};
