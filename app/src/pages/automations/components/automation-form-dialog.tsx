import { useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useConnections } from "@/features/connections/hooks/use-connections";
import { useMe } from "@/features/users/hooks/use-users";
import { useCreateAutomation } from "@/features/automations/hooks/use-automations";
import { Routes } from "@/routes/routes";
import { automationSchema, type AutomationFormValues } from "../validation-schemas/automation.schema";
import { DEFAULT_SCHEDULE, toCron } from "../utils/schedule.utils";
import { ScheduleEditor } from "./schedule-editor";
import { ConnectionStatuses } from "@/features/connections/interfaces/connections.interfaces";
import { DEFAULT_TIMEZONE } from "@/config/constants/browser.constants";

/**
 * Create an automation from the page (§10.2). Pre-approvals are added on its page afterwards; most people create
 * automations by asking a bot, which sorts everything out in the chat.
 */
export const AutomationFormDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { data: bots } = useBots();
  const { data: connections } = useConnections();
  const { data: me } = useMe();
  const create = useCreateAutomation();
  const navigate = useNavigate();
  const tz = me?.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  const defaults: AutomationFormValues = { name: "", bot_id: "", instructions: "", schedule: DEFAULT_SCHEDULE, timezone: tz, connection_ids: [], email_results: false, memory_plan: "" };
  const form = useForm<AutomationFormValues>({ resolver: zodResolver(automationSchema), defaultValues: defaults });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: create.isPending, onClose: () => { form.reset(defaults); onClose(); } });

  useEffect(() => {
    if (open && !form.formState.isDirty) form.setValue("timezone", tz);
  }, [open, tz, form]);

  const active = (connections ?? []).filter((c) => c.status === ConnectionStatuses.ACTIVE);

  const submit = (v: AutomationFormValues) =>
    create.mutate(
      {
        name: v.name,
        bot_id: v.bot_id,
        instructions: v.instructions,
        cron_expression: toCron(v.schedule),
        timezone: v.timezone,
        connection_ids: v.connection_ids,
        email_results: v.email_results,
        memory_plan: v.memory_plan || null,
      },
      { onSuccess: (a) => { form.reset(defaults); onClose(); navigate(Routes.automations.detail(a.id)); } },
    );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New automation</DialogTitle>
            <DialogDescription>A job a bot does by itself on a schedule. Tip: you can also just ask a bot, e.g. "every Friday at 4pm, send me a sales summary".</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="new-automation" className="space-y-4" onSubmit={form.handleSubmit(submit)}>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Morning briefing" maxLength={120} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bot_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose a bot" /></SelectTrigger></FormControl>
                    <SelectContent>{bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.emoji} {b.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="instructions" render={({ field }) => (
                <FormItem>
                  <FormLabel>What should it do each time?</FormLabel>
                  <FormControl><Textarea rows={4} placeholder="Summarise my unread emails and today's meetings, most important first." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-ink">When</p>
                <ScheduleEditor
                  idPrefix="new-automation"
                  value={form.watch("schedule")}
                  onChange={(s) => form.setValue("schedule", s, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                  timezone={form.watch("timezone")}
                  onTimezoneChange={(t) => form.setValue("timezone", t, { shouldDirty: true })}
                />
                {form.formState.errors.schedule && <p className="text-sm font-semibold text-error">{form.formState.errors.schedule.cron?.message ?? form.formState.errors.schedule.time?.message}</p>}
              </div>
              <FormField control={form.control} name="connection_ids" render={({ field }) => (
                <FormItem>
                  <FormLabel>Accounts it uses</FormLabel>
                  {active.length ? (
                    <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-hairline p-1">
                      {active.map((c) => (
                        <label key={c.id} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-sm px-2 hover:bg-surface-sunken">
                          <Checkbox checked={field.value.includes(c.id)} onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />
                          <span className="min-w-0 truncate text-sm"><strong className="text-ink">{c.label}</strong> <span className="text-muted-foreground">· {c.service_name}</span></span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <FormDescription>No connected accounts yet. Connect services on the Connections page if this job needs them.</FormDescription>
                  )}
                </FormItem>
              )} />
              <FormField control={form.control} name="memory_plan" render={({ field }) => (
                <FormItem>
                  <FormLabel>What to remember between runs (optional)</FormLabel>
                  <FormControl><Input placeholder="Items already reported, so only new ones are sent" maxLength={2000} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="email_results" render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2.5">
                  <div>
                    <FormLabel>Also email me the results</FormLabel>
                    <FormDescription>Results always appear in a chat with the bot.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" form="new-automation" loading={create.isPending}>Save automation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};
