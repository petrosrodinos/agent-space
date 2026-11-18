import { z } from "zod";
import { isCronShape } from "../utils/schedule.utils";
import { ScheduleKinds, CRON_ANY } from "@/features/automations/interfaces/automations.interfaces";

const scheduleSchema = z
  .object({
    kind: z.enum(ScheduleKinds),
    time: z.string(),
    weekday: z.string(),
    day_of_month: z.string(),
    minute: z.string(),
    cron: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === ScheduleKinds.CUSTOM && !isCronShape(v.cron)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cron"], message: "Use 5 parts: minute hour day month weekday" });
    if (v.kind !== ScheduleKinds.CUSTOM && v.kind !== ScheduleKinds.HOURLY && !/^\d{2}:\d{2}$/.test(v.time)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["time"], message: "Pick a time" });
  });

export const automationSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  bot_id: z.string().min(1, "Pick a bot"),
  instructions: z.string().trim().min(3, "Say what it should do on each run").max(20000),
  schedule: scheduleSchema,
  timezone: z.string().min(1),
  connection_ids: z.array(z.string()),
  email_results: z.boolean(),
  memory_plan: z.string().trim().max(2000),
});
export type AutomationFormValues = z.infer<typeof automationSchema>;

export const preApprovalSchema = z.object({
  action_type: z.string().min(1, "Pick an action"),
  connection_id: z.string(),
  target: z
    .string()
    .trim()
    .min(1, "Name one specific place")
    .max(300)
    .refine((t) => t !== CRON_ANY && !/^\w+:\s*\*?$/.test(t), "Name one specific place, e.g. channel:#security"),
});
export type PreApprovalFormValues = z.infer<typeof preApprovalSchema>;
