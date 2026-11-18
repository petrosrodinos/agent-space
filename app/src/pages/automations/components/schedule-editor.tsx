import type { FC } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleKindOptions, WeekdayOptions, type ScheduleKind } from "@/config/constants/dropdowns/automations/automation-form.options";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { toCron, type ScheduleValue } from "../utils/schedule.utils";
import { ScheduleKinds } from "@/features/automations/interfaces/automations.interfaces";

interface Props {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  idPrefix?: string;
}

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => String(i + 1));
const MINUTES = ["0", "15", "30", "45"];

/** Friendly schedule picker (§10.2 "When"): presets in the user's time zone, plus a custom cron for power users. */
export const ScheduleEditor: FC<Props> = ({ value, onChange, timezone, onTimezoneChange, idPrefix = "schedule" }) => {
  const set = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });
  const tzOptions = TimezoneOptions.some((o) => o.value === timezone) ? TimezoneOptions : [{ value: timezone, label: timezone }, ...TimezoneOptions];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-kind`}>Repeats</Label>
          <Select value={value.kind} onValueChange={(k) => set({ kind: k as ScheduleKind, cron: k === ScheduleKinds.CUSTOM ? toCron(value) : value.cron })}>
            <SelectTrigger id={`${idPrefix}-kind`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ScheduleKindOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {value.kind === ScheduleKinds.HOURLY ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-minute`}>At minute</Label>
            <Select value={value.minute} onValueChange={(minute) => set({ minute })}>
              <SelectTrigger id={`${idPrefix}-minute`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => <SelectItem key={m} value={m}>:{m.padStart(2, "0")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : value.kind === ScheduleKinds.CUSTOM ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cron`}>Cron expression</Label>
            <Input id={`${idPrefix}-cron`} value={value.cron} onChange={(e) => set({ cron: e.target.value })} placeholder="0 7 * * 1-5" className="font-mono" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-time`}>Time</Label>
            <Input id={`${idPrefix}-time`} type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
          </div>
        )}

        {value.kind === ScheduleKinds.WEEKLY && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-weekday`}>On</Label>
            <Select value={value.weekday} onValueChange={(weekday) => set({ weekday })}>
              <SelectTrigger id={`${idPrefix}-weekday`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {WeekdayOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {value.kind === ScheduleKinds.MONTHLY && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-dom`}>On day</Label>
            <Select value={value.day_of_month} onValueChange={(day_of_month) => set({ day_of_month })}>
              <SelectTrigger id={`${idPrefix}-dom`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS_OF_MONTH.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-tz`}>Time zone</Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger id={`${idPrefix}-tz`}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {tzOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {value.kind === ScheduleKinds.CUSTOM && <p className="text-xs text-muted-foreground">Five parts: minute, hour, day of month, month, day of week. Your organisation may limit how often automations can run.</p>}
    </div>
  );
};
