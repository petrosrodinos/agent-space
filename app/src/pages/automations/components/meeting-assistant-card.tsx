import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useConnections } from "@/features/connections/hooks/use-connections";
import { ConnectionStatuses } from "@/features/connections/interfaces/connections.interfaces";
import { useDisableMeetingAssistant, useMeetingAssistant, useSetMeetingAssistant } from "@/features/automations/hooks/use-automations";
import { formatDateTime } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { meetingAssistantSchema, type MeetingAssistantFormValues } from "../validation-schemas/meeting-assistant.schema";

const CALENDAR_SERVICES = ["googlecalendar", "outlook", "microsoft_outlook", "outlookcalendar"];
const EMAIL_SERVICES = ["gmail", "outlook", "microsoft_outlook"];
const NO_EMAIL = "none";

/** §16 Meeting assistant: a bot prepares briefs before meetings and drafts follow-ups after (two automations). */
export const MeetingAssistantCard: FC = () => {
  const { data, isPending } = useMeetingAssistant();
  const disable = useDisableMeetingAssistant();
  const [open, setOpen] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  if (isPending) return <Skeleton className="mb-5 h-[84px] rounded-lg" />;
  const parts = [data?.briefs && "Briefs before meetings", data?.follow_ups && "Follow-up drafts after"].filter(Boolean).join(" · ");
  return (
    <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface p-3 shadow-sticker sm:p-4" aria-label="Meeting assistant">
      <CalendarClock className="h-6 w-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">Meeting assistant</p>
        <p className="text-sm text-muted-foreground">
          {data?.enabled ? (
            <>
              {parts}
              {data.briefs?.next_run_at ? ` · next check ${formatDateTime(data.briefs.next_run_at)}` : ""}
              {data.briefs && (
                <>
                  {" · "}
                  <Link to={Routes.automations.detail(data.briefs.id)} className="font-semibold text-primary hover:underline">Runs</Link>
                </>
              )}
            </>
          ) : (
            "A bot prepares a brief before each meeting and drafts the follow-up email after."
          )}
        </p>
      </div>
      <div className="flex gap-2">
        {data?.enabled && <Button variant="outline" onClick={() => setConfirmOff(true)}>Turn off</Button>}
        <Button variant={data?.enabled ? "outline" : "default"} onClick={() => setOpen(true)}>{data?.enabled ? "Change" : "Set up"}</Button>
      </div>
      <MeetingAssistantDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmationDialog
        isOpen={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Turn off the meeting assistant?"
        description="Its two automations and their memory are deleted. You can set it up again any time."
        confirmText="Turn off"
        variant="destructive"
        isLoading={disable.isPending}
        onConfirm={() => disable.mutate(undefined, { onSuccess: () => setConfirmOff(false) })}
      />
    </section>
  );
};

const MeetingAssistantDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { data } = useMeetingAssistant();
  const { data: bots } = useBots();
  const { data: connections } = useConnections();
  const save = useSetMeetingAssistant();
  const active = (connections ?? []).filter((c) => c.status === ConnectionStatuses.ACTIVE);
  const calendars = active.filter((c) => CALENDAR_SERVICES.includes(c.service_key));
  const emails = active.filter((c) => EMAIL_SERVICES.includes(c.service_key));
  const form = useForm<MeetingAssistantFormValues>({ resolver: zodResolver(meetingAssistantSchema), defaultValues: { bot_id: "", calendar_connection_id: "", email_connection_id: NO_EMAIL, briefs: true, follow_ups: true } });

  useEffect(() => {
    if (!open) return;
    const c = data?.config;
    form.reset({ bot_id: c?.bot_id ?? "", calendar_connection_id: c?.calendar_connection_id ?? calendars[0]?.id ?? "", email_connection_id: c?.email_connection_id ?? emails[0]?.id ?? NO_EMAIL, briefs: data?.enabled ? !!data.briefs : true, follow_ups: data?.enabled ? !!data.follow_ups : true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const submit = (v: MeetingAssistantFormValues) =>
    save.mutate({ bot_id: v.bot_id, calendar_connection_id: v.calendar_connection_id, email_connection_id: v.email_connection_id === NO_EMAIL ? null : v.email_connection_id, briefs: v.briefs, follow_ups: v.follow_ups }, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meeting assistant</DialogTitle>
          <DialogDescription>Every hour the bot checks your calendar: a brief for meetings in the next hour, and a follow-up draft for meetings that just ended. It never sends anything to attendees.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="meeting-assistant" className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <FormField control={form.control} name="bot_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Bot</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Choose a bot" /></SelectTrigger></FormControl>
                  <SelectContent>{bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="calendar_connection_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Calendar</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Choose your calendar" /></SelectTrigger></FormControl>
                  <SelectContent>{calendars.map((c) => <SelectItem key={c.id} value={c.id}>{c.label} · {c.service_name}</SelectItem>)}</SelectContent>
                </Select>
                {!calendars.length && <FormDescription>Connect Google Calendar or Outlook on the Connections page first.</FormDescription>}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email_connection_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Email (for history and follow-up drafts)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NO_EMAIL}>No email</SelectItem>
                    {emails.map((c) => <SelectItem key={c.id} value={c.id}>{c.label} · {c.service_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="briefs" render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2.5">
                <div><FormLabel>Briefs before meetings</FormLabel><FormDescription>Who's coming, recent emails, purpose and an agenda.</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="follow_ups" render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2.5">
                <div><FormLabel>Follow-up drafts after</FormLabel><FormDescription>Saved as a draft for you to review and send.</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            {form.formState.errors.briefs && <p className="text-sm font-semibold text-error">{form.formState.errors.briefs.message}</p>}
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="meeting-assistant" loading={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
