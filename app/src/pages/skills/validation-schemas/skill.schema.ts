import { z } from "zod";

export const skillFormSchema = z.object({
  name: z.string().trim().min(1, "Give the skill a name").max(80),
  emoji: z.string().max(16),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().trim().min(1, "Say when the skill should be used").max(1000),
  instructions: z.string().trim().min(1, "Add the steps").max(20000),
  questions: z.array(z.object({ question: z.string().max(300), required: z.boolean() })).max(20),
  required_services: z.string().max(400),
  result: z.string().max(300),
  change_summary: z.string().max(300),
});
export type SkillFormValues = z.infer<typeof skillFormSchema>;
