import { CronExpressionParser } from 'cron-parser';
import { ScheduleFrequency } from 'generated/prisma';

/** Minimum gap between runs allowed by the organisation's "Most frequent schedule allowed" (§13.4). */
const MIN_GAP_MINUTES: Record<ScheduleFrequency, number> = { EVERY_15_MIN: 15, EVERY_HOUR: 60, DAILY: 23 * 60 };
const FREQUENCY_LABEL: Record<ScheduleFrequency, string> = { EVERY_15_MIN: 'every 15 minutes', EVERY_HOUR: 'every hour', DAILY: 'once a day' };

export function isValidTimezone(tz: string) {
    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** Validates a 5-field cron expression in a time zone. Returns an error message, or null when valid. */
export function cronError(expr: string, tz: string): string | null {
    if (expr.trim().split(/\s+/).length !== 5) return 'Use a 5-part schedule: minute hour day-of-month month day-of-week.';
    if (!isValidTimezone(tz)) return `Unknown time zone "${tz}".`;
    try {
        CronExpressionParser.parse(expr, { tz });
        return null;
    } catch (e) {
        return `Invalid schedule: ${(e as Error).message}`;
    }
}

export function nextRuns(expr: string, tz: string, count = 1, from = new Date()): Date[] {
    const it = CronExpressionParser.parse(expr, { tz, currentDate: from });
    const out: Date[] = [];
    for (let i = 0; i < count; i++) out.push(it.next().toDate());
    return out;
}

export function nextRun(expr: string, tz: string, from = new Date()): Date | null {
    try {
        return nextRuns(expr, tz, 1, from)[0];
    } catch {
        return null;
    }
}

/** Checks the schedule against the organisation's most frequent allowed schedule. Returns an error message or null. */
export function frequencyError(expr: string, tz: string, max: ScheduleFrequency): string | null {
    const runs = nextRuns(expr, tz, 30);
    let minGap = Infinity;
    for (let i = 1; i < runs.length; i++) minGap = Math.min(minGap, (runs[i].getTime() - runs[i - 1].getTime()) / 60_000);
    return minGap < MIN_GAP_MINUTES[max] ? `Your organisation allows automations to run at most ${FREQUENCY_LABEL[max]}.` : null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: string) => n.padStart(2, '0');

/** Friendly description of common schedules ("Every day at 07:00"); falls back to the raw expression. */
export function describeCron(expr: string): string {
    const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
    const isNum = (s: string) => /^\d+$/.test(s);
    if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `Every ${m.slice(2)} minutes`;
    if (isNum(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `Every hour at :${pad(m)}`;
    if (isNum(m) && /^\*\/\d+$/.test(h) && dom === '*' && mon === '*' && dow === '*') return `Every ${h.slice(2)} hours at :${pad(m)}`;
    if (!isNum(m) || !isNum(h)) return `Schedule: ${expr}`;
    const at = `${pad(h)}:${pad(m)}`;
    if (dom === '*' && mon === '*' && dow === '*') return `Every day at ${at}`;
    if (dom === '*' && mon === '*' && (dow === '1-5' || dow === 'MON-FRI')) return `Every weekday at ${at}`;
    if (dom === '*' && mon === '*' && /^[0-7](,[0-7])*$/.test(dow)) {
        const names = dow.split(',').map((d) => DAYS[Number(d) % 7]);
        return `Every ${names.join(', ')} at ${at}`;
    }
    if (isNum(dom) && mon === '*' && dow === '*') return `Every month on day ${dom} at ${at}`;
    return `Schedule: ${expr}`;
}
