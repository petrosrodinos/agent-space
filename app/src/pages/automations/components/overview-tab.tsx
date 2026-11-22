import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Mail, Plug, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { SettingsCard } from "@/components/ui/setting-row";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionTypeOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useConfirmPreApprovals, useRemovePreApproval, useUpdateAutomation } from "@/features/automations/hooks/use-automations";
import type { Automation } from "@/features/automations/interfaces/automations.interfaces";
import { Routes } from "@/routes/routes";
import { fromCron, isCronShape, toCron, type ScheduleValue } from "../utils/schedule.utils";
import { ScheduleEditor } from "./schedule-editor";
import { PreApprovalDialog } from "./pre-approval-dialog";
import { ResultsConversationPicker } from "./results-conversation-picker";
import { AutomationStatuses, ResultDestinationKinds } from "@/features/automations/interfaces/automations.interfaces";
import { ConnectionStatuses } from "@/features/connections/interfaces/connections.interfaces";
import { DEFAULT_SKILL_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { DEFAULT_TIMEZONE } from "@/config/constants/browser.constants";

export const OverviewTab: FC<{ automation: Automation }> = ({ automation: a }) => {
  const update = useUpdateAutomation();
  const confirm = useConfirmPreApprovals();
  const removePre = useRemovePreApproval();
  const [name, setName] = useState(a.name);
  const [instructions, setInstructions] = useState(a.instructions);
  const [schedule, setSchedule] = useState<ScheduleValue>(fromCron(a.cron_expression));
  const [timezone, setTimezone] = useState(a.timezone ?? DEFAULT_TIMEZONE);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setName(a.name);
    setInstructions(a.instructions);
    setSchedule(fromCron(a.cron_expression));
    setTimezone(a.timezone ?? DEFAULT_TIMEZONE);
  }, [a.id, a.name, a.instructions, a.cron_expression, a.timezone]);

  const cron = toCron(schedule);
  const scheduleDirty = cron !== a.cron_expression || timezone !== a.timezone;
  const needsConfirm = !a.pre_approvals_confirmed_at && a.pre_approvals.length > 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {a.status === AutomationStatuses.NEEDS_ATTENTION && a.status_reason && (
          <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-bold text-ink">This automation needs attention</p>
              <p className="mt-0.5 text-body">{a.status_reason}</p>
            </div>
          </div>
        )}

        <SettingsCard title="What it does" description="Plain-language instructions the bot follows on every run.">
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="automation-name">Name</Label>
              <Input id="automation-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="automation-instructions">Instructions</Label>
              <Textarea id="automation-instructions" rows={7} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={20000} />
            </div>
            {a.pre_approvals.length > 0 && instructions.trim() !== a.instructions && <p className="text-xs font-semibold text-warning">Changing the instructions means you'll confirm its pre-approvals again.</p>}
            <div className="flex justify-end">
              <Button
                disabled={(!name.trim() || name === a.name) && (instructions.trim().length < 3 || instructions.trim() === a.instructions)}
                loading={update.isPending}
                onClick={() => update.mutate({ id: a.id, ...(name.trim() && name !== a.name ? { name: name.trim() } : {}), ...(instructions.trim() !== a.instructions && instructions.trim().length >= 3 ? { instructions: instructions.trim() } : {}) })}
              >
                Save
              </Button>
            </div>
          </div>
        </SettingsCard>

        {a.trigger ? (
          <SettingsCard title="When" description="Runs each time this happens. Saving a schedule below switches it to a schedule instead.">
            <p className="mt-2 text-sm text-ink">
              <strong>{a.trigger.name ?? a.trigger.slug}</strong> <span className="text-muted-foreground">· {a.trigger.connection.label} ({a.trigger.connection.service_name})</span>
            </p>
            <div className="mt-3"><ScheduleEditor value={schedule} onChange={setSchedule} timezone={timezone} onTimezoneChange={setTimezone} idPrefix="edit-schedule" /></div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" disabled={!isCronShape(cron)} loading={update.isPending} onClick={() => update.mutate({ id: a.id, cron_expression: cron, timezone })}>
                Switch to this schedule
              </Button>
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard title="When" description={a.schedule_description ? `${a.schedule_description} (${a.timezone})` : undefined}>
            <div className="mt-3"><ScheduleEditor value={schedule} onChange={setSchedule} timezone={timezone} onTimezoneChange={setTimezone} idPrefix="edit-schedule" /></div>
            <div className="mt-3 flex justify-end">
              <Button disabled={!scheduleDirty || !isCronShape(cron)} loading={update.isPending} onClick={() => update.mutate({ id: a.id, cron_expression: cron, timezone })}>
                Save schedule
              </Button>
            </div>
          </SettingsCard>
        )}

        <SettingsCard
          title="Pre-approved actions"
          description="Approved once, for this automation only. Each covers one kind of action to one specific place."
          actions={<Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Add</Button>}
        >
          {needsConfirm && (
            <div className="mb-3 flex flex-col gap-3 rounded-lg bg-warning-soft p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body"><strong className="text-ink">Confirm these again.</strong> The automation changed, so runs ask before these actions until you confirm.</p>
              <Button size="sm" loading={confirm.isPending} onClick={() => confirm.mutate(a.id)}><ShieldCheck /> Confirm</Button>
            </div>
          )}
          {a.pre_approvals.length ? (
            <ul className="mt-1 divide-y divide-hairline">
              {a.pre_approvals.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{getDropdownOptionLabel(ActionTypeOptions, p.action_type, p.action_type)}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.target}{p.connection ? ` · ${p.connection.label}` : " · any of its accounts"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Remove pre-approval" onClick={() => removePre.mutate({ id: a.id, pid: p.id })}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing is pre-approved. Runs pause and ask you before sending, posting, deleting or anything else that needs approval.</p>
          )}
        </SettingsCard>
      </div>

      <div className="min-w-0 space-y-5">
        <SettingsCard title="Details">
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="eyebrow mb-1">Bot</dt>
              <dd className="flex items-center gap-2">
                <BotAvatar seed={a.bot.avatar_seed} color={a.bot.color} size={32} name={a.bot.name} />
                <Link to={Routes.bots.detail(a.bot.id)} className="font-bold text-ink hover:underline">{a.bot.name}</Link>
              </dd>
            </div>
            {a.skill && (
              <div>
                <dt className="eyebrow mb-1">Skill</dt>
                <dd className="font-semibold text-ink">{a.skill.emoji ?? DEFAULT_SKILL_EMOJI} {a.skill.name}</dd>
              </div>
            )}
            <div>
              <dt className="eyebrow mb-1">Uses</dt>
              <dd className="space-y-1.5">
                {a.connections.length ? (
                  a.connections.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5"><Plug className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{c.label}</span></span>
                      {c.status !== ConnectionStatuses.ACTIVE && <StatusPill tone="warning">{getDropdownOptionLabel(ConnectionStatusOptions, c.status, c.status)}</StatusPill>}
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground">No connected accounts</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">Results go to</dt>
              <dd className="space-y-1.5">
                <ResultsConversationPicker automation={a} />
                {a.result_destinations.filter((d) => d.kind !== ResultDestinationKinds.CONVERSATION).map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5">
                    {d.kind === ResultDestinationKinds.EMAIL ? <Mail className="h-4 w-4 text-muted-foreground" /> : <Plug className="h-4 w-4 text-muted-foreground" />}
                    {d.kind === ResultDestinationKinds.EMAIL ? (
                      <span>Email{d.email ? ` to ${d.email}` : " to you"}</span>
                    ) : (
                      <span className="truncate">{d.connection?.label} {d.target}</span>
                    )}
                  </div>
                ))}
              </dd>
            </div>
            {a.uses_cloud_computer && (
              <div>
                <dt className="eyebrow mb-1">Cloud computer</dt>
                <dd>Uses the bot's cloud computer</dd>
              </div>
            )}
            <div>
              <dt className="eyebrow mb-1">Runs as</dt>
              <dd className="text-muted-foreground">You — it can only use what you can access.</dd>
            </div>
          </dl>
        </SettingsCard>
      </div>
      <PreApprovalDialog automation={a} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
};
