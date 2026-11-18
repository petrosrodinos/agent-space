import { useEffect, useState, type FC } from "react";
import { Copy, Globe, Lock, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonAvatar } from "@/components/ui/bot-avatar";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useSetPublicLink, useShareArtifact } from "@/features/artifacts/hooks/use-artifacts";
import type { Artifact, ArtifactRole, ArtifactSharing } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { ArtifactShareRoleOptions, ArtifactSharingOptions } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArtifactRoles, ArtifactSharingLevels } from "@/features/artifacts/interfaces/artifacts.interfaces";

type ShareRole = Exclude<ArtifactRole, typeof ArtifactRoles.OWNER>;

const RoleSelect: FC<{ value: ShareRole; onChange: (v: ShareRole) => void; disabled?: boolean; label: string }> = ({ value, onChange, disabled, label }) => (
  <Select value={value} onValueChange={(v) => onChange(v as ShareRole)} disabled={disabled}>
    <SelectTrigger className="h-9 w-[132px] shrink-0" aria-label={label}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {ArtifactShareRoleOptions.map((o) => (
        <SelectItem key={o.id} value={o.id}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Sharing level, per-member roles and the public link (§7.5 Sharing and permissions). */
export const SharePanel: FC<{ artifact: Artifact; isAdmin: boolean }> = ({ artifact: a, isAdmin }) => {
  const isOwner = a.role === ArtifactRoles.OWNER;
  const { data: members } = useMembers();
  const share = useShareArtifact();
  const publicLink = useSetPublicLink();
  const [level, setLevel] = useState<ArtifactSharing>(a.sharing_level);
  const [orgRole, setOrgRole] = useState<ShareRole>(a.organization_role);
  const [shares, setShares] = useState(a.shares.map((s) => ({ user_id: s.user.id, role: s.role })));
  const [adding, setAdding] = useState("");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState(toDateInput(a.public_link.expires_at));

  useEffect(() => {
    setLevel(a.sharing_level);
    setOrgRole(a.organization_role);
    setShares(a.shares.map((s) => ({ user_id: s.user.id, role: s.role })));
    setExpiry(toDateInput(a.public_link.expires_at));
  }, [a]);

  const dirty =
    level !== a.sharing_level ||
    orgRole !== a.organization_role ||
    JSON.stringify(shares) !== JSON.stringify(a.shares.map((s) => ({ user_id: s.user.id, role: s.role })));
  const others = (members ?? []).filter((m) => m.user.id !== a.owner?.id && !shares.some((s) => s.user_id === m.user.id));
  const memberOf = (id: string) => members?.find((m) => m.user.id === id)?.user ?? a.shares.find((s) => s.user.id === id)?.user;

  const save = () => share.mutate({ id: a.id, sharing_level: level, shares, organization_role: level === ArtifactSharingLevels.ORGANIZATION || level === ArtifactSharingLevels.PUBLIC_LINK ? orgRole : undefined });
  const copy = async (text: string, what: string) => {
    await platform.clipboard.writeText(text);
    toast({ title: `${what} copied`, duration: 1500 });
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="eyebrow mb-2">Who can open it</p>
        <div className="grid gap-1.5" role="radiogroup" aria-label="Sharing level">
          {ArtifactSharingOptions.map((o) => {
            const Icon = o.id === ArtifactSharingLevels.PRIVATE ? Lock : o.id === ArtifactSharingLevels.PUBLIC_LINK ? Globe : Users;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={level === o.id}
                disabled={!isOwner}
                onClick={() => setLevel(o.id)}
                className={cn(
                  "flex min-h-[52px] items-center gap-3 rounded-[14px] border px-3 py-2 text-left transition-colors disabled:cursor-default",
                  level === o.id ? "border-primary bg-primary-soft" : "border-hairline hover:bg-surface-sunken",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {(level === ArtifactSharingLevels.ORGANIZATION || level === ArtifactSharingLevels.PUBLIC_LINK) && (
        <section className="flex items-center justify-between gap-3">
          <Label>Everyone in the organisation can</Label>
          <RoleSelect value={orgRole} onChange={setOrgRole} disabled={!isOwner} label="Organisation role" />
        </section>
      )}

      {level !== ArtifactSharingLevels.PRIVATE && (
        <section>
          <p className="eyebrow mb-2">People</p>
          <ul className="space-y-1">
            {a.owner && (
              <li className="flex items-center gap-3 rounded-[12px] p-1.5">
                <PersonAvatar name={a.owner.name} email={a.owner.email} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{a.owner.name ?? a.owner.email}</span>
                <span className="pr-2 text-xs font-semibold text-muted-foreground">Owner</span>
              </li>
            )}
            {shares.map((s) => {
              const u = memberOf(s.user_id);
              return (
                <li key={s.user_id} className="flex items-center gap-2 rounded-[12px] p-1.5">
                  <PersonAvatar name={u?.name} email={u?.email} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{u?.name ?? u?.email ?? "Member"}</span>
                  <RoleSelect value={s.role} disabled={!isOwner} label={`Role for ${u?.name ?? u?.email}`} onChange={(role) => setShares((list) => list.map((x) => (x.user_id === s.user_id ? { ...x, role } : x)))} />
                  {isOwner && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${u?.name ?? u?.email}`} onClick={() => setShares((list) => list.filter((x) => x.user_id !== s.user_id))}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {isOwner && others.length > 0 && (
            <div className="mt-2 flex gap-2">
              <Select value={adding} onValueChange={setAdding}>
                <SelectTrigger className="min-w-0 flex-1" aria-label="Add a member">
                  <SelectValue placeholder="Add a member…" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!adding}
                onClick={() => {
                  setShares((list) => [...list, { user_id: adding, role: ArtifactRoles.VIEWER }]);
                  setAdding("");
                }}
              >
                <UserPlus /> Add
              </Button>
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <Button className="w-full" disabled={!dirty} loading={share.isPending} onClick={save}>
          Save sharing
        </Button>
      )}

      {(level === ArtifactSharingLevels.PUBLIC_LINK || a.public_link.enabled) && (
        <section className="space-y-3 rounded-[18px] border border-hairline p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">Public link</p>
              <p className="text-xs text-muted-foreground">{a.public_link.enabled ? "Anyone with the link can open it" : "Off — the link doesn't work"}</p>
            </div>
            <Switch
              checked={a.public_link.enabled}
              disabled={(!isOwner && !(isAdmin && a.public_link.enabled)) || publicLink.isPending}
              onCheckedChange={(enabled) => publicLink.mutate({ id: a.id, enabled })}
              aria-label="Public link"
            />
          </div>
          {a.public_link.enabled && (
            <div className="flex gap-2">
              <Input readOnly value={a.url} aria-label="Public link" className="min-w-0 flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => copy(a.url, "Link")}>
                <Copy />
              </Button>
            </div>
          )}
          {isOwner && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="artifact-password">{a.public_link.has_password ? "Password (set — type to change)" : "Password (optional)"}</Label>
                <div className="flex gap-2">
                  <PasswordInput id="artifact-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={a.public_link.has_password ? "••••••••" : "No password"} autoComplete="new-password" />
                  <Button variant="outline" disabled={!password} onClick={() => publicLink.mutate({ id: a.id, enabled: a.public_link.enabled, password }, { onSuccess: () => setPassword("") })}>
                    Set
                  </Button>
                </div>
                {a.public_link.has_password && (
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => publicLink.mutate({ id: a.id, enabled: a.public_link.enabled, password: "" })}>
                    Remove password
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="artifact-expiry">Expires</Label>
                <div className="flex gap-2">
                  <Input id="artifact-expiry" type="date" value={expiry} min={new Date(Date.now() + 86400_000).toISOString().slice(0, 10)} onChange={(e) => setExpiry(e.target.value)} />
                  <Button
                    variant="outline"
                    disabled={expiry === toDateInput(a.public_link.expires_at)}
                    onClick={() => publicLink.mutate({ id: a.id, enabled: a.public_link.enabled, expires_at: expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null })}
                  >
                    {expiry ? "Set" : "Clear"}
                  </Button>
                </div>
              </div>
              {(
                [
                  ["allow_search_engines", "Allow search engines", "Let Google and others list this page"],
                  ["allow_embedding", "Allow embedding", "Let other websites show it in a frame"],
                  ["public_ai_enabled", "AI features for visitors", "Counts toward your usage"],
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Switch checked={a.public_link[key]} onCheckedChange={(v) => publicLink.mutate({ id: a.id, enabled: a.public_link.enabled, [key]: v })} aria-label={label} />
                </div>
              ))}
              {a.embed_code && (
                <div className="space-y-1.5">
                  <Label>Embed code</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={a.embed_code} aria-label="Embed code" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button variant="outline" size="icon" aria-label="Copy embed code" onClick={() => copy(a.embed_code!, "Embed code")}>
                      <Copy />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          {!isOwner && <p className="text-xs text-muted-foreground">Only the owner can change the public link{isAdmin ? " (you can switch it off as an admin)" : ""}.</p>}
        </section>
      )}
      {!isOwner && <p className="text-xs text-muted-foreground">You're {a.role === ArtifactRoles.EDITOR ? "an editor" : `a ${getDropdownOptionLabel(ArtifactShareRoleOptions, a.role).toLowerCase()}`}. Only the owner can change sharing.</p>}
    </div>
  );
};
