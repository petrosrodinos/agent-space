import { z } from "zod";

export const editWidgetSchema = z.object({
  title: z.string().trim().min(1, "Give it a name").max(120, "Keep it under 120 characters"),
  refresh_prompt: z.string().trim().min(1, "Tell the bot what to show").max(2000, "Keep it under 2,000 characters"),
});

export type EditWidgetFormValues = z.infer<typeof editWidgetSchema>;
