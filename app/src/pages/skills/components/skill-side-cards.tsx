import { useEffect, useMemo, useState, type FC } from "react";
import { Download, FileText, History, Loader2, Plus, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsCard } from "@/components/ui/setting-row";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useAddSkillFile, useRemoveSkillFile, useRestoreSkillVersion, useSetSkillBots, useShareSkill } from "@/features/skills/hooks/use-skills";
import { getFileUrl, uploadFile } from "@/features/files/services/files.services";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import type { Skill, SkillSharing } from "@/features/skills/interfaces/skills.interfaces";
import { SkillRoleOptions, SkillSharingOptions } from "@/config/constants/dropdowns/shared/status.options";
import { formatBytes, formatDateTime } from "@/lib/date";
import { SkillRoles, SkillSharingLevels, type SkillShareRole } from "@/features/skills/interfaces/skills.interfaces";

export const GiveToBotsCard: FC<{ skill: Skill }> = ({ skill }) => {
  const { data: bots } = useBots();
  const save = useSetSkillBots();
  const initial = useMemo(() => new Set(skill.bots.map((b) => b.id)), [skill]);
  const [sel, setSel] = useState(initial);
  useEffect(() => setSel(new Set(initial)), [initial]);
  const editable = (bots ?? []).filter((b) => b.can_edit);
  const dirty = [...sel].sort().join() !== [...initial].sort().join();
  return (
    <SettingsCard title="Give to bots" description="Bots with this skill use it automatically when a request matches.">
      <div className="divide-y divide-hairline">
        {editable.map((b) => (
          <label key={b.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
            <Checkbox checked={sel.has(b.id)} onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(b.id); else n.delete(b.id); return n; })} />
            <BotAvatar emoji={b.emoji} color={b.color} size={32} name={b.name} />
            <span className="font-semibold text-ink">{b.name}</span>
          </label>
        ))}
        {!editable.length && <p className="py-3 text-sm text-muted-foreground">You don't have any bots you can edit yet.</p>}
      </div>
      <div className="flex justify-end pt-3">
        <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ id: skill.id, bot_ids: [...sel] })}>
          Save
        </Button>
      </div>
    </SettingsCard>
  );
};

export const SharingCard: FC<{ skill: Skill; isAdmin: boolean }> = ({ skill, isAdmin }) => {
  const { data: members } = useMembers();
  const share = useShareSkill();
  const [level, setLevel] = useState<SkillSharing>(skill.sharing_level);
  const [shares, setShares] = useState(skill.shares.map((s) => ({ user_id: s.user_id, role: s.role === SkillRoles.EDITOR ? SkillRoles.EDITOR : SkillRoles.USER })));
  useEffect(() => {
    setLevel(skill.sharing_level);
    setShares(skill.shares.map((s) => ({ user_id: s.user_id, role: s.role === SkillRoles.EDITOR ? SkillRoles.EDITOR : SkillRoles.USER })));
  }, [skill]);
  const [adding, setAdding] = useState("");
  const options = SkillSharingOptions.filter((o) => o.id !== SkillSharingLevels.ORGANIZATION || isAdmin);
  const candidates = (members ?? []).filter((m) => m.user.id !== skill.owner?.id && !shares.some((s) => s.user_id === m.user.id));
  return (
    <SettingsCard title="Sharing" description={isAdmin ? undefined : "Only Owners and Admins can share a skill with the whole organisation."}>
      <div className="space-y-4 py-3">
        <SegmentedControl ariaLabel="Sharing level" value={level} options={options} onChange={(v) => setLevel(v as SkillSharing)} />
        {level === SkillSharingLevels.SPECIFIC_MEMBERS && (
          <div className="space-y-2">
            {shares.map((s) => {
              const m = members?.find((x) => x.user.id === s.user_id);
              return (
                <div key={s.user_id} className="flex items-center gap-2">
                  <PersonAvatar name={m?.user.name} email={m?.user.email} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m?.user.name ?? m?.user.email ?? "Member"}</span>
                  <Select value={s.role} onValueChange={(v) => setShares((cur) => cur.map((x) => (x.user_id === s.user_id ? { ...x, role: v as SkillShareRole } : x)))}>
                    <SelectTrigger className="h-9 w-[120px]" aria-label="Role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SkillRoleOptions.filter((r) => r.id !== SkillRoles.OWNER).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShares((cur) => cur.filter((x) => x.user_id !== s.user_id))} aria-label="Remove">
                    <X />
                  </Button>
                </div>
              );
            })}
            {candidates.length > 0 && (
              <div className="flex gap-2">
                <Select value={adding} onValueChange={setAdding}>
                  <SelectTrigger aria-label="Add a member">
                    <SelectValue placeholder="Add a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((m) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        {m.user.name ?? m.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={!adding} onClick={() => { setShares((cur) => [...cur, { user_id: adding, role: SkillRoles.USER }]); setAdding(""); }}>
                  <Plus /> Add
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button size="sm" loading={share.isPending} onClick={() => share.mutate({ id: skill.id, sharing_level: level, shares: level === SkillSharingLevels.SPECIFIC_MEMBERS ? shares : [] })}>
          Save sharing
        </Button>
      </div>
    </SettingsCard>
  );
};

export const VersionsCard: FC<{ skill: Skill; canEdit: boolean }> = ({ skill, canEdit }) => {
  const restore = useRestoreSkillVersion();
  return (
    <SettingsCard title="Versions" description="Every change is saved as a version.">
      <ol className="divide-y divide-hairline">
        {skill.versions.map((v) => (
          <li key={v.id} className="flex items-start gap-3 py-3">
            <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                v{v.version} {v.version === skill.current_version && <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">Current</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {v.change_summary ?? "Edited"} · {v.created_by?.name ?? "Agent Space"} · {formatDateTime(v.created_at)}
              </p>
            </div>
            {canEdit && v.version !== skill.current_version && (
              <Button variant="ghost" size="sm" loading={restore.isPending && restore.variables?.version === v.version} onClick={() => restore.mutate({ id: skill.id, version: v.version })}>
                <RotateCcw /> Restore
              </Button>
            )}
          </li>
        ))}
      </ol>
    </SettingsCard>
  );
};

/** Skill files (§6.7): templates, examples and guides the bot reads with read_file when following the skill. */
export const SkillFilesCard: FC<{ skill: Skill; canEdit: boolean }> = ({ skill, canEdit }) => {
  const add = useAddSkillFile();
  const remove = useRemoveSkillFile();
  const [uploading, setUploading] = useState<string | null>(null);
  const files = skill.files ?? [];
  const pick = async () => {
    const picked = await platform.files.pick({ multiple: true });
    for (const file of picked.slice(0, 10)) {
      setUploading(file.name);
      try {
        const stored = await uploadFile(file, "skill");
        await add.mutateAsync({ id: skill.id, file_id: stored.id });
      } catch (e) {
        toast({ title: `Could not attach ${file.name}`, description: (e as Error).message, variant: "error" });
      }
    }
    setUploading(null);
  };
  const open = async (fileId: string) => {
    try {
      const { url } = await getFileUrl(fileId);
      platform.links.openExternal(url);
    } catch (e) {
      toast({ title: "Could not open the file", description: (e as Error).message, variant: "error" });
    }
  };
  if (!canEdit && !files.length) return null;
  return (
    <SettingsCard title="Files" description="Templates, examples or guides the bot reads when it follows this skill.">
      <ul className="divide-y divide-hairline">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{f.filename}</span>
              <span className="block text-xs text-muted-foreground">{formatBytes(f.size)}</span>
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Download ${f.filename}`} onClick={() => void open(f.id)}>
              <Download />
            </Button>
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Remove ${f.filename}`} loading={remove.isPending && remove.variables?.fileId === f.id} onClick={() => remove.mutate({ id: skill.id, fileId: f.id })}>
                <X />
              </Button>
            )}
          </li>
        ))}
        {!files.length && <li className="py-2 text-sm text-muted-foreground">No files yet.</li>}
      </ul>
      {canEdit && (
        <Button variant="outline" className="mt-2 w-full" onClick={pick} disabled={!!uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? `Attaching ${uploading}…` : "Attach files"}
        </Button>
      )}
    </SettingsCard>
  );
};
