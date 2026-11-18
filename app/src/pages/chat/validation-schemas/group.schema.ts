import { z } from "zod";

export const newGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(80),
  emoji: z.string().min(1).max(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bot_ids: z.array(z.string()).min(1, "Pick at least one bot"),
  user_ids: z.array(z.string()),
  lead_bot_id: z.string().optional(),
});
export type NewGroupFormData = z.infer<typeof newGroupSchema>;
