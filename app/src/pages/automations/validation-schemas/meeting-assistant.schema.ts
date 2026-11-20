import { z } from "zod";

export const meetingAssistantSchema = z
  .object({
    bot_id: z.string().min(1, "Pick a bot"),
    calendar_connection_id: z.string().min(1, "Pick your calendar"),
    email_connection_id: z.string(),
    briefs: z.boolean(),
    follow_ups: z.boolean(),
  })
  .refine((v) => v.briefs || v.follow_ups, { path: ["briefs"], message: "Turn on briefs, follow-ups or both" });

export type MeetingAssistantFormValues = z.infer<typeof meetingAssistantSchema>;
