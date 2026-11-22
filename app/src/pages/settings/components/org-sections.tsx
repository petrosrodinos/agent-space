import { useEffect, useMemo, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Mail, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar, BotAvatar } from "@/components/ui/bot-avatar";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { toast } from "@/hooks/use-toast";
import { platform } from "@/platform";
import {
  useCancelInvitation, useCreateInviteLink, useCurrentOrganization, useDeleteOrganization, useInvitations, useInviteMembers, useLeaveOrganization, useMembers, useRemoveMember,
  useResendInvitation, useTransferOwnership, useUpdateMemberRole, useUpdateOrganization, useUpdateOrganizationSettings,
} from "@/features/organizations/hooks/use-organizations";
import type { Organization, OrganizationSettings } from "@/features/organizations/interfaces/organizations.interfaces";
import type { OrgRole } from "@/features/users/interfaces/users.interfaces";
import { useBots, useModels } from "@/features/bots/hooks/use-bots";
import { useActivity, useSetUsageLimit, useUsage } from "@/features/usage/hooks/use-usage";
import { useMe } from "@/features/users/hooks/use-users";
import { useVoiceModels } from "@/features/voice/hooks/use-voice-session";
import { BotColorOptions } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { BiometricApprovalScopeOptions, EnforcedApprovalOptions, InvitationExpiryOptions, LimitReachedActionOptions, MaxFileSizeOptions, MinApprovalLevelOptions, ModelPolicyOptions, OrgConversationRetentionOptions, OrgRoleFormOptions, UsageLimitScopeOptions, WhoCanOptions, ApprovalTimeoutMinuteOptions, fromApprovalTimeoutValue, toApprovalTimeoutValue } from "@/config/constants/dropdowns/organizations/organization-form.options";
import { AppLanguageOptions } from "@/config/constants/dropdowns/users/user-settings-form.options";
import { ModelCostTierOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { UsageKindOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMoney, timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { SelectSetting, SwitchSetting } from "./setting-controls";
import { TimezonePicker } from "./timezone-picker";
import { SettingsSkeleton } from "./personal-sections";
import { inviteSchema, organizationSchema, type InviteFormValues, type OrganizationFormValues } from "../validation-schemas/settings.schema";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { PickerValues } from "@/config/constants/filters";
import { ModelPolicies } from "@/features/organizations/interfaces/organizations.interfaces";
import { UsageLimitScopes, type UsageLimitScope } from "@/features/usage/interfaces/usage.interfaces";

const useOrgSetting = () => {
  const { data: org } = useCurrentOrganization();
  const update = useUpdateOrganizationSettings();
  const set = <K extends keyof OrganizationSettings>(k: K, v: OrganizationSettings[K]) => update.mutate({ [k]: v } as Partial<OrganizationSettings>);
  return { org, s: org?.settings, set, update };
};

export const OrganizationSection: FC = () => {
  const { org, s, set } = useOrgSetting();
  const update = useUpdateOrganization();
  const updateSettings = useUpdateOrganizationSettings();
  const defaults = useMemo<OrganizationFormValues | null>(
    () => (org ? { name: org.name, brand_color: org.brand_color ?? "#6B4EFF", company_instructions: org.settings.company_instructions ?? "", default_timezone: org.settings.default_timezone, auto_join_domain: org.settings.auto_join_domain ?? "" } : null),
    [org],
  );
  const form = useForm<OrganizationFormValues>({ resolver: zodResolver(organizationSchema), values: defaults ?? undefined });
  if (!org || !s || !defaults) return <SettingsSkeleton />;
  const onSubmit = async (v: OrganizationFormValues) => {
    await update.mutateAsync({ name: v.name, brand_color: v.brand_color });
    await updateSettings.mutateAsync({ company_instructions: v.company_instructions || null, default_timezone: v.default_timezone, auto_join_domain: v.auto_join_domain || null });
    form.reset(v);
  };
  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsCard title="General">
            <div className="space-y-4 py-3">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Organisation name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField
                control={form.control}
                name="brand_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand colour</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {BotColorOptions.map((c) => (
                        <button key={c.id} type="button" aria-label={c.label} aria-pressed={field.value === c.id} onClick={() => field.onChange(c.id)} className={cn("h-9 w-9 rounded-md", field.value === c.id && "ring-2 ring-ink ring-offset-2 ring-offset-surface")} style={{ backgroundColor: c.id }} />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company instructions</FormLabel>
                    <FormControl><Textarea rows={5} placeholder="We're Acme, a B2B analytics company. Friendly, concise tone. Never promise discounts." {...field} /></FormControl>
                    <FormDescription>Applied to every bot in the organisation.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="auto_join_domain" render={({ field }) => <FormItem><FormLabel>Auto-join by email domain</FormLabel><FormControl><Input placeholder="company.com" {...field} /></FormControl><FormDescription>Anyone signing up with this domain joins as a Member. Leave empty to turn off.</FormDescription><FormMessage /></FormItem>} />
            </div>
            <FormField control={form.control} name="default_timezone" render={({ field }) => <SettingRow label="Default time zone"><TimezonePicker value={field.value} onChange={field.onChange} /></SettingRow>} />
            <div className="flex justify-end pt-3"><Button type="submit" loading={update.isPending || updateSettings.isPending} disabled={!form.formState.isDirty}>Save</Button></div>
          </SettingsCard>
        </form>
      </Form>
      <SettingsCard title="Members, bots and data">
        <SelectSetting label="Default language" value={s.default_language} options={AppLanguageOptions} onChange={(v) => set("default_language", v as OrganizationSettings["default_language"])} />
        <SwitchSetting label="Invite links" checked={s.invite_links_enabled} onChange={(v) => set("invite_links_enabled", v)} />
        <SelectSetting label="Default role for new invites" value={s.default_invite_role} options={OrgRoleFormOptions.filter((o) => o.id !== OrgRoles.OWNER)} onChange={(v) => set("default_invite_role", v as OrgRole)} />
        <SelectSetting label="Invitation expiry" value={s.invitation_expiry} options={InvitationExpiryOptions} onChange={(v) => set("invitation_expiry", v as OrganizationSettings["invitation_expiry"])} />
        <SelectSetting label="Who can create bots" value={s.who_can_create_bots} options={WhoCanOptions} onChange={(v) => set("who_can_create_bots", v as OrganizationSettings["who_can_create_bots"])} />
        <SelectSetting label="Who can create skills" value={s.who_can_create_skills} options={WhoCanOptions} onChange={(v) => set("who_can_create_skills", v as OrganizationSettings["who_can_create_skills"])} />
        <SwitchSetting label="Starter skills library" checked={s.starter_skills_enabled} onChange={(v) => set("starter_skills_enabled", v)} />
        <SwitchSetting label="Temporary chats allowed" checked={s.temporary_chats_allowed} onChange={(v) => set("temporary_chats_allowed", v)} />
        <SwitchSetting label="Members may add connections by access key" checked={s.members_api_key_connections} onChange={(v) => set("members_api_key_connections", v)} />
        <SwitchSetting label="Members may add their own tool servers" checked={s.members_private_tool_servers !== false} onChange={(v) => set("members_private_tool_servers", v)} />
        <SwitchSetting label="Web search" checked={s.builtin_web_search} onChange={(v) => set("builtin_web_search", v)} />
        <SwitchSetting label="Document creation" checked={s.builtin_document_creation} onChange={(v) => set("builtin_document_creation", v)} />
        <SelectSetting label="Keep conversations for" value={s.conversation_retention} options={OrgConversationRetentionOptions} onChange={(v) => set("conversation_retention", v as OrganizationSettings["conversation_retention"])} />
        <SelectSetting label="Maximum file size" value={s.max_file_size} options={MaxFileSizeOptions} onChange={(v) => set("max_file_size", v as OrganizationSettings["max_file_size"])} />
        <SwitchSetting label="Members may export their data" checked={s.members_may_export} onChange={(v) => set("members_may_export", v)} />
      </SettingsCard>
    </div>
  );
};

const InviteDialog: FC<{ open: boolean; isOwner: boolean; defaultRole: OrgRole; onClose: () => void }> = ({ open, isOwner, defaultRole, onClose }) => {
  const invite = useInviteMembers();
  const form = useForm<InviteFormValues>({ resolver: zodResolver(inviteSchema), defaultValues: { emails: "", role: defaultRole } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: invite.isPending, onClose: () => { form.reset(); onClose(); } });
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>They'll get an email with a link to join. Invitations expire based on your settings.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="invite-form" className="space-y-4" onSubmit={form.handleSubmit((v) => invite.mutate({ emails: v.emails.split(/[\s,;]+/).filter(Boolean), role: v.role }, { onSuccess: () => { form.reset(); onClose(); } }))}>
              <FormField control={form.control} name="emails" render={({ field }) => <FormItem><FormLabel>Emails</FormLabel><FormControl><Textarea rows={3} placeholder="anna@acme.com, nikos@acme.com" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {OrgRoleFormOptions.filter((r) => isOwner || r.id !== OrgRoles.OWNER).map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{OrgRoleFormOptions.find((r) => r.id === field.value)?.description}</FormDescription>
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={invite.isPending}>Cancel</Button>
            <Button type="submit" form="invite-form" loading={invite.isPending}><Mail /> Send invitations</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const MembersSection: FC<{ org: Organization }> = ({ org }) => {
  const isOwner = org.my_role === OrgRoles.OWNER;
  const isAdmin = isOwner || org.my_role === OrgRoles.ADMIN;
  const { data: me } = useMe();
  const { data: members, isPending } = useMembers();
  const { data: invitations } = useInvitations(isAdmin);
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const link = useCreateInviteLink();
  const cancel = useCancelInvitation();
  const resend = useResendInvitation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [linkRole, setLinkRole] = useState<OrgRole>(OrgRoles.MEMBER);

  const copyLink = () =>
    link.mutate(linkRole, {
      onSuccess: async (r) => {
        await platform.clipboard.writeText(r.url).catch(() => undefined);
        toast({ title: "Invite link copied", description: `Anyone with it can join as ${getDropdownOptionLabel(OrgRoleFormOptions, r.role)} until ${formatDate(r.expires_at)}.` });
      },
    });

  return (
    <div className="space-y-4">
      <SettingsCard title={`Members (${members?.length ?? org._count.members})`} actions={isAdmin && <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus /> Invite</Button>}>
        {isPending ? (
          <div className="space-y-2 py-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <ul className="divide-y divide-hairline">
            {members?.map((m) => {
              const self = m.user.id === me?.user.id;
              const canChange = isAdmin && !self && (isOwner || m.role !== OrgRoles.OWNER);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <PersonAvatar name={m.user.name} email={m.user.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{m.user.name ?? m.user.email} {self && <span className="text-xs font-semibold text-muted-foreground">(you)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.user.email} · joined {formatDate(m.joined_at)}</p>
                  </div>
                  {canChange ? (
                    <Select value={m.role} onValueChange={(v) => updateRole.mutate({ userId: m.user.id, role: v as OrgRole })}>
                      <SelectTrigger className="h-10 w-[130px]" aria-label={`Role for ${m.user.name ?? m.user.email}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OrgRoleFormOptions.filter((r) => isOwner || r.id !== OrgRoles.OWNER).map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{getDropdownOptionLabel(OrgRoleFormOptions, m.role)}</Badge>
                  )}
                  {canChange && (
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setRemoving({ id: m.user.id, name: m.user.name ?? m.user.email })} aria-label="Remove member"><Trash2 /></Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
      {isAdmin && (
        <>
          {org.settings.invite_links_enabled && (
            <SettingsCard title="Invite link" description="Share a link anyone in your team can use to join.">
              <div className="flex flex-col gap-2 py-3 sm:flex-row">
                <Select value={linkRole} onValueChange={(v) => setLinkRole(v as OrgRole)}>
                  <SelectTrigger className="sm:w-[160px]" aria-label="Role for link"><SelectValue /></SelectTrigger>
                  <SelectContent>{OrgRoleFormOptions.filter((r) => r.id !== OrgRoles.OWNER).map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" loading={link.isPending} onClick={copyLink}><Link2 /> Create and copy link</Button>
              </div>
            </SettingsCard>
          )}
          <SettingsCard title="Pending invitations">
            {!invitations?.length ? (
              <p className="py-4 text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{i.is_link ? "Invite link" : i.email}</p>
                      <p className="text-xs text-muted-foreground">{getDropdownOptionLabel(OrgRoleFormOptions, i.role)} · expires {formatDate(i.expires_at)} · by {i.invited_by?.name ?? i.invited_by?.email ?? "someone"}</p>
                    </div>
                    {!i.is_link && <Button variant="ghost" size="sm" loading={resend.isPending && resend.variables === i.id} onClick={() => resend.mutate(i.id)}><RotateCcw /> Re-send</Button>}
                    <Button variant="ghost" size="sm" onClick={() => cancel.mutate(i.id)}><X /> Cancel</Button>
                  </li>
                ))}
              </ul>
            )}
          </SettingsCard>
        </>
      )}
      <InviteDialog open={inviteOpen} isOwner={isOwner} defaultRole={org.settings.default_invite_role === OrgRoles.ADMIN ? OrgRoles.ADMIN : OrgRoles.MEMBER} onClose={() => setInviteOpen(false)} />
      <ConfirmationDialog isOpen={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.name}?`} description="They lose access to this organisation. Their private connections and keys here are deleted; their skills and artifacts pass to an Owner." confirmText="Remove" variant="destructive" isLoading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })} />
    </div>
  );
};

export const AiModelsSection: FC = () => {
  const { org, s, set, update } = useOrgSetting();
  const { data: models } = useModels();
  const { data: voiceModels } = useVoiceModels();
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  useEffect(() => setAllowed(new Set(org?.allowed_model_ids ?? [])), [org]);
  if (!s || !org) return <SettingsSkeleton />;
  const dirty = [...allowed].sort().join() !== [...(org.allowed_model_ids ?? [])].sort().join();
  return (
    <SettingsCard title="AI models" description="Which models bots in this organisation can use.">
      <SelectSetting label="Default model for new bots" value={s.default_model_id ?? PickerValues.RECOMMENDED} options={[{ id: PickerValues.RECOMMENDED, label: "Recommended" }, ...(models ?? []).map((m) => ({ id: m.id, label: `${m.name} (${m.provider})` }))]} onChange={(v) => set("default_model_id", v === PickerValues.RECOMMENDED ? null : v)} />
      <SelectSetting label="Allowed models" value={s.model_policy} options={ModelPolicyOptions} onChange={(v) => set("model_policy", v as OrganizationSettings["model_policy"])} />
      {s.model_policy === ModelPolicies.APPROVED_LIST && (
        <div className="py-3">
          <p className="mb-2 text-sm text-muted-foreground">Bots on a model removed from the list switch to the default and their owners are notified.</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {models?.map((m) => (
              <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm px-2 hover:bg-surface-sunken">
                <Checkbox checked={allowed.has(m.id)} onCheckedChange={(v) => setAllowed((cur) => { const n = new Set(cur); if (v) n.add(m.id); else n.delete(m.id); return n; })} />
                <span className="text-sm font-semibold text-ink">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.provider} · {getDropdownOptionLabel(ModelCostTierOptions, m.cost_tier)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end pt-3"><Button size="sm" disabled={!dirty} loading={update.isPending} onClick={() => update.mutate({ allowed_model_ids: [...allowed] })}>Save approved list</Button></div>
        </div>
      )}
      <SwitchSetting label="Automatic fallback to a similar model" checked={s.model_auto_fallback} onChange={(v) => set("model_auto_fallback", v)} />
      <SwitchSetting label="Compare replies with another model" checked={s.model_compare_enabled} onChange={(v) => set("model_compare_enabled", v)} />
      <SelectSetting
        label="Voice mode model"
        description={voiceModels?.models.find((m) => m.id === (s.voice_model ?? voiceModels.default))?.description ?? "Used for real-time voice conversations with every bot."}
        value={s.voice_model ?? PickerValues.RECOMMENDED}
        options={[
          { id: PickerValues.RECOMMENDED, label: `Default${voiceModels ? ` (${voiceModels.models.find((m) => m.id === voiceModels.default)?.label ?? voiceModels.default})` : ""}` },
          ...(voiceModels?.models ?? []).map((m) => ({ id: m.id, label: m.label })),
        ]}
        onChange={(v) => set("voice_model", v === PickerValues.RECOMMENDED ? null : v)}
      />
      <SwitchSetting
        label="Camera and screen sharing in voice mode"
        description="Members can show the bot what they're looking at while talking. Pictures aren't stored unless they post a snapshot."
        checked={s.voice_visual_input}
        onChange={(v) => set("voice_visual_input", v)}
      />
    </SettingsCard>
  );
};

export const SafetySection: FC = () => {
  const { s, set, update } = useOrgSetting();
  if (!s) return <SettingsSkeleton />;
  const enforced = new Set(s.enforced_approvals);
  const biometric = new Set(s.biometric_approval_scopes ?? []);
  return (
    <SettingsCard title="Approvals and safety" description="Organisation rules always win over bot and personal settings.">
      <SelectSetting label="Minimum approval level" value={s.min_approval_level} options={MinApprovalLevelOptions} onChange={(v) => set("min_approval_level", v as OrganizationSettings["min_approval_level"])} />
      <SettingRow label="Always require approval for" description="These can never be pre-approved." stack>
        <div className="grid gap-1 sm:grid-cols-2">
          {EnforcedApprovalOptions.map((o) => (
            <label key={o.id} className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <Checkbox checked={enforced.has(o.id)} onCheckedChange={(v) => { const n = new Set(enforced); if (v) n.add(o.id); else n.delete(o.id); set("enforced_approvals", [...n]); }} />
              <span className="text-sm text-ink">{o.label}</span>
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Fingerprint / face unlock on the phone for" description="Payments and website passwords always need it. Lock-screen Approve / Reject is not offered for these; they open the app." stack>
        <div className="grid gap-1 sm:grid-cols-2">
          {BiometricApprovalScopeOptions.map((o) => (
            <label key={o.id} className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <Checkbox checked={biometric.has(o.id)} onCheckedChange={(v) => { const n = new Set(biometric); if (v) n.add(o.id); else n.delete(o.id); set("biometric_approval_scopes", [...n]); }} />
              <span className="text-sm text-ink">{o.label}</span>
            </label>
          ))}
        </div>
      </SettingRow>
      <SwitchSetting label="Bots consulting other bots" checked={s.bots_consulting_enabled} onChange={(v) => set("bots_consulting_enabled", v)} />
      <SelectSetting
        label="Approval timeout"
        description="Accepting automatically never applies to the actions above that always require approval, or to payments and passwords."
        value={toApprovalTimeoutValue(s.approval_timeout_minutes, s.approval_timeout_action)}
        options={ApprovalTimeoutMinuteOptions}
        onChange={(v) => update.mutate(fromApprovalTimeoutValue(v))}
      />
      <SelectSetting label="When a usage limit is reached" value={s.limit_reached_action} options={LimitReachedActionOptions} onChange={(v) => set("limit_reached_action", v as OrganizationSettings["limit_reached_action"])} />
    </SettingsCard>
  );
};

export const UsageSection: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const { data, isPending } = useUsage(period);
  const setLimit = useSetUsageLimit();
  const [limitScope, setLimitScope] = useState<UsageLimitScope>(UsageLimitScopes.ORGANIZATION);
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const { data: members } = useMembers();
  const { data: bots } = useBots();
  const months = useMemo(() => Array.from({ length: 6 }).map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); }), []);
  if (isPending || !data) return <SettingsSkeleton />;
  const orgLimit = data.limits.find((l) => l.scope === UsageLimitScopes.ORGANIZATION);
  return (
    <div className="space-y-4">
      <SettingsCard title="Usage overview" actions={
        <Select value={period ?? months[0]} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[130px]" aria-label="Month"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      }>
        <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-4">
          <div className="rounded-md bg-primary-soft p-3"><p className="text-xs font-semibold text-accent-foreground">Total</p><p className="text-2xl font-extrabold text-ink">{formatMoney(data.total_cost)}</p></div>
          {data.by_kind.map((k) => (
            <div key={k.kind} className="rounded-md bg-surface-sunken p-3"><p className="text-xs font-semibold text-muted-foreground">{getDropdownOptionLabel(UsageKindOptions, k.kind, k.kind)}</p><p className="text-lg font-bold text-ink">{formatMoney(k.cost)}</p></div>
          ))}
          {orgLimit && <div className="rounded-md bg-surface-sunken p-3"><p className="text-xs font-semibold text-muted-foreground">Monthly limit</p><p className="text-lg font-bold text-ink">{formatMoney(orgLimit.monthly_limit)}</p></div>}
        </div>
        {data.by_day.length > 0 && (
          <div className="h-56 w-full py-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_day.map((d) => ({ day: d.day.slice(5, 10), cost: Number(d.cost.toFixed(4)) }))}>
                <CartesianGrid vertical={false} stroke="var(--hairline)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-text)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-text)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)" }} />
                <Bar dataKey="cost" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SettingsCard>
      <div className="grid gap-4 lg:grid-cols-3">
        <SettingsCard title="By member">
          <ul className="divide-y divide-hairline">{data.by_member.map((r, i) => <li key={i} className="flex items-center gap-2 py-2.5"><PersonAvatar name={r.user?.name} email={r.user?.email} size={24} /><span className="min-w-0 flex-1 truncate text-sm">{r.user?.name ?? r.user?.email ?? "System"}</span><span className="text-sm font-bold">{formatMoney(r.cost)}</span></li>)}{!data.by_member.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}</ul>
        </SettingsCard>
        <SettingsCard title="By bot">
          <ul className="divide-y divide-hairline">{data.by_bot.map((r, i) => <li key={i} className="flex items-center gap-2 py-2.5">{r.bot ? <BotAvatar seed={r.bot.avatar_seed} color={r.bot.color} size={24} /> : null}<span className="min-w-0 flex-1 truncate text-sm">{r.bot?.name ?? "Other"}</span><span className="text-sm font-bold">{formatMoney(r.cost)}</span></li>)}{!data.by_bot.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}</ul>
        </SettingsCard>
        <SettingsCard title="By model">
          <ul className="divide-y divide-hairline">{data.by_model.map((r, i) => <li key={i} className="flex items-center gap-2 py-2.5"><span className="min-w-0 flex-1 truncate text-sm">{r.model?.name ?? "Other"}</span><span className="text-sm font-bold">{formatMoney(r.cost)}</span></li>)}{!data.by_model.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}</ul>
        </SettingsCard>
      </div>
      {isAdmin && (
        <SettingsCard title="Monthly usage limits" description="Alerts at 80% and 100%. Bots pause when a limit is reached.">
          <ul className="divide-y divide-hairline">
            {data.limits.map((l) => {
              const member = members?.find((m) => m.user.id === l.user_id)?.user;
              const bot = bots?.find((b) => b.id === l.bot_id);
              const spent = l.scope === UsageLimitScopes.ORGANIZATION ? data.total_cost : l.scope === UsageLimitScopes.MEMBER ? (data.by_member.find((r) => r.user?.id === l.user_id)?.cost ?? 0) : (data.by_bot.find((r) => r.bot?.id === l.bot_id)?.cost ?? 0);
              const pct = l.monthly_limit > 0 ? Math.min(100, Math.round((spent / l.monthly_limit) * 100)) : 100;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  {member ? <PersonAvatar name={member.name} email={member.email} size={24} /> : bot ? <BotAvatar seed={bot.avatar_seed} color={bot.color} size={24} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{member ? (member.name ?? member.email) : bot ? bot.name : getDropdownOptionLabel(UsageLimitScopeOptions, l.scope)}</span>
                    <span className="mt-1 block h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-sunken" aria-label={`${pct}% used`}>
                      <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-error" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatMoney(spent)} of</span>
                  <span className="font-bold">{formatMoney(l.monthly_limit)}</span>
                  <Button variant="ghost" size="sm" onClick={() => setLimit.mutate({ scope: l.scope, user_id: l.user_id ?? undefined, bot_id: l.bot_id ?? undefined, monthly_limit: null })}><X /> Remove</Button>
                </li>
              );
            })}
            {!data.limits.length && <li className="py-3 text-sm text-muted-foreground">No limits set.</li>}
          </ul>
          <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap">
            <Select value={limitScope} onValueChange={(v) => { setLimitScope(v as typeof limitScope); setTarget(""); }}>
              <SelectTrigger className="sm:w-[180px]" aria-label="Limit scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(UsageLimitScopes).map((v) => <SelectItem key={v} value={v}>{getDropdownOptionLabel(UsageLimitScopeOptions, v)}</SelectItem>)}
              </SelectContent>
            </Select>
            {limitScope !== UsageLimitScopes.ORGANIZATION && (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="sm:w-[220px]" aria-label={limitScope === UsageLimitScopes.MEMBER ? "Member" : "Bot"}><SelectValue placeholder={limitScope === UsageLimitScopes.MEMBER ? "Choose a member" : "Choose a bot"} /></SelectTrigger>
                <SelectContent>
                  {limitScope === UsageLimitScopes.MEMBER
                    ? (members ?? []).map((m) => <SelectItem key={m.user.id} value={m.user.id}>{m.user.name ?? m.user.email}</SelectItem>)
                    : (bots ?? []).map((b) => <SelectItem key={b.id} value={b.id}><span className="flex items-center gap-2"><BotAvatar seed={b.avatar_seed} color={b.color} size={24} />{b.name}</span></SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input inputMode="decimal" placeholder="USD per month" value={amount} onChange={(e) => setAmount(e.target.value)} className="sm:w-[160px]" aria-label="Amount" />
            <Button
              disabled={!/^\d+(\.\d{1,2})?$/.test(amount) || (limitScope !== UsageLimitScopes.ORGANIZATION && !target)}
              loading={setLimit.isPending}
              onClick={() => setLimit.mutate({ scope: limitScope, user_id: limitScope === UsageLimitScopes.MEMBER ? target : undefined, bot_id: limitScope === UsageLimitScopes.BOT ? target : undefined, monthly_limit: Number(amount) }, { onSuccess: () => { setAmount(""); setTarget(""); } })}
            >
              Set limit
            </Button>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">Limits are in US dollars per calendar month. Bot limits can also be set in each bot's Sharing tab.</p>
        </SettingsCard>
      )}
    </div>
  );
};

export const ActivitySection: FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isPending } = useActivity({ page, search: search || undefined });
  return (
    <SettingsCard title="Activity history" description="Every bot action and admin change in this organisation.">
      <Input className="my-3" placeholder="Filter by action, e.g. connection.used" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Filter activity" />
      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {data?.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-sm">{a.actor_bot ? a.actor_bot.name : a.actor_user?.name ?? a.actor_user?.email ?? "System"}</TableCell>
                    <TableCell><code className="rounded-xs bg-surface-sunken px-1.5 py-0.5 text-xs">{a.action}</code></TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">{a.connection?.label ?? ""} {a.metadata ? JSON.stringify(a.metadata).slice(0, 80) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y divide-hairline md:hidden">
            {data?.data.map((a) => (
              <li key={a.id} className="py-2.5">
                <code className="rounded-xs bg-surface-sunken px-1.5 py-0.5 text-xs">{a.action}</code>
                <p className="mt-1 text-sm">{a.actor_bot ? a.actor_bot.name : a.actor_user?.name ?? "System"}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
              </li>
            ))}
          </ul>
          {!data?.data.length && <p className="py-4 text-sm text-muted-foreground">No activity yet.</p>}
          {data && data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button variant="outline" size="sm" disabled={!data.pagination.has_prev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">{data.pagination.page} / {data.pagination.total_pages}</span>
              <Button variant="outline" size="sm" disabled={!data.pagination.has_next} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
};

export const DangerSection: FC<{ org: Organization; onLeft: () => void }> = ({ org, onLeft }) => {
  const isOwner = org.my_role === OrgRoles.OWNER;
  const { data: members } = useMembers();
  const { data: me } = useMe();
  const transfer = useTransferOwnership();
  const leave = useLeaveOrganization();
  const del = useDeleteOrganization();
  const [to, setTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const others = (members ?? []).filter((m) => m.user.id !== me?.user.id);
  return (
    <div className="space-y-4">
      {isOwner && (
        <SettingsCard title="Transfer ownership" description="The new Owner gets full control; you become an Admin.">
          <div className="flex flex-col gap-2 py-3 sm:flex-row">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger aria-label="New owner"><SelectValue placeholder="Choose a member" /></SelectTrigger>
              <SelectContent>{others.map((m) => <SelectItem key={m.user.id} value={m.user.id}>{m.user.name ?? m.user.email}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" disabled={!to} onClick={() => setConfirmTransfer(true)}>Transfer</Button>
          </div>
        </SettingsCard>
      )}
      <SettingsCard title="Leave organisation">
        <SettingRow label={`Leave ${org.name}`} description={isOwner ? "The last Owner must hand over ownership first." : "You'll lose access to its bots, chats and connections."}>
          <Button variant="outline" onClick={() => setConfirmLeave(true)}>Leave</Button>
        </SettingRow>
      </SettingsCard>
      {isOwner && (
        <SettingsCard title="Delete organisation">
          <SettingRow label="Delete this organisation" description="Everything in it is removed. It can be restored for 30 days.">
            <Button variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> Delete</Button>
          </SettingRow>
        </SettingsCard>
      )}
      <ConfirmationDialog isOpen={confirmTransfer} onClose={() => setConfirmTransfer(false)} title="Transfer ownership?" description="You'll become an Admin. This can only be undone by the new Owner." confirmText="Transfer" isLoading={transfer.isPending} onConfirm={() => transfer.mutate(to, { onSuccess: () => setConfirmTransfer(false) })} />
      <ConfirmationDialog isOpen={confirmLeave} onClose={() => setConfirmLeave(false)} title={`Leave ${org.name}?`} description="You can only rejoin with a new invitation." confirmText="Leave" variant="destructive" isLoading={leave.isPending} onConfirm={() => leave.mutate(undefined, { onSuccess: () => { setConfirmLeave(false); onLeft(); } })} />
      <Dialog open={deleting} onOpenChange={(o) => !o && !del.isPending && setDeleting(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {org.name}?</DialogTitle>
            <DialogDescription>Type the organisation name to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Organisation name" placeholder={org.name} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(false)} disabled={del.isPending}>Cancel</Button>
            <Button variant="destructive" disabled={typed !== org.name} loading={del.isPending} onClick={() => del.mutate(undefined, { onSuccess: () => { setDeleting(false); onLeft(); } })}>Delete organisation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
