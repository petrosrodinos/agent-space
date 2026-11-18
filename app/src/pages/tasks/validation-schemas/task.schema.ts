import { z } from "zod";

export const newTaskSchema = z.object({
  bot_id: z.string().min(1, "Pick a bot"),
  prompt: z.string().trim().min(3, "Describe the job").max(8000),
});
export type NewTaskFormValues = z.infer<typeof newTaskSchema>;
