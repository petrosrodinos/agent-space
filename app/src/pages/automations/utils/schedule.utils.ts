import type { ScheduleKind } from "@/config/constants/dropdowns/automations/automation-form.options";
import { ScheduleKinds, CRON_ANY, CRON_WEEKDAYS } from "@/features/automations/interfaces/automations.interfaces";

export interface ScheduleValue {
  kind: ScheduleKind;
  time: string; // "07:00"
  weekday: string; // "1" = Monday
  day_of_month: string; // "1".."28"
  minute: string; // for hourly
  cron: string; // custom
}

export const DEFAULT_SCHEDULE: ScheduleValue = { kind: ScheduleKinds.DAILY, time: "08:00", weekday: "1", day_of_month: "1", minute: "0", cron: "0 8 * * *" };

/** Builds the 5-part cron expression for a friendly schedule. */
export function toCron(v: ScheduleValue): string {
  const [h, m] = (v.time || "08:00").split(":").map((x) => String(Number(x)));
  switch (v.kind) {
    case ScheduleKinds.DAILY:
      return `${m} ${h} * * *`;
    case ScheduleKinds.WEEKDAYS:
      return `${m} ${h} * * ${CRON_WEEKDAYS}`;
    case ScheduleKinds.WEEKLY:
      return `${m} ${h} * * ${v.weekday}`;
    case ScheduleKinds.MONTHLY:
      return `${m} ${h} ${v.day_of_month} * *`;
    case ScheduleKinds.HOURLY:
      return `${Number(v.minute) || 0} * * * *`;
    default:
      return v.cron.trim();
  }
}

const pad = (s: string) => s.padStart(2, "0");

/** Reads a cron expression back into the friendly editor; anything unusual becomes "custom". */
export function fromCron(cron: string | null | undefined): ScheduleValue {
  if (!cron) return DEFAULT_SCHEDULE;
  const [m, h, dom, mon, dow] = cron.trim().split(/\s+/);
  const num = (s?: string) => !!s && /^\d+$/.test(s);
  const base = { ...DEFAULT_SCHEDULE, cron };
  if (num(m) && h === CRON_ANY && dom === CRON_ANY && mon === CRON_ANY && dow === CRON_ANY) return { ...base, kind: ScheduleKinds.HOURLY, minute: m };
  if (!num(m) || !num(h) || mon !== CRON_ANY) return { ...base, kind: ScheduleKinds.CUSTOM };
  const time = `${pad(h)}:${pad(m)}`;
  if (dom === CRON_ANY && dow === CRON_ANY) return { ...base, kind: ScheduleKinds.DAILY, time };
  if (dom === CRON_ANY && dow === CRON_WEEKDAYS) return { ...base, kind: ScheduleKinds.WEEKDAYS, time };
  if (dom === CRON_ANY && /^[0-6]$/.test(dow)) return { ...base, kind: ScheduleKinds.WEEKLY, time, weekday: dow };
  if (num(dom) && dow === CRON_ANY) return { ...base, kind: ScheduleKinds.MONTHLY, time, day_of_month: dom };
  return { ...base, kind: ScheduleKinds.CUSTOM };
}

export const isCronShape = (cron: string) => cron.trim().split(/\s+/).length === 5;
