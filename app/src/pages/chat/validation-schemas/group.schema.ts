import { z } from "zod";

export const newGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatar_seed: z.string().regex(/^[a-zA-Z0-9]{4,32}$/),
  bot_ids: z.array(z.string()).min(1, "Pick at least one bot"),
  user_ids: z.array(z.string()),
  lead_bot_id: z.string().optional(),
});
export type NewGroupFormData = z.infer<typeof newGroupSchema>;

/** Group details panel: same identity fields as a bot (avatar, name, colour). */
export const groupIdentitySchema = newGroupSchema.pick({ name: true, color: true, avatar_seed: true });
export type GroupIdentityFormValues = z.infer<typeof groupIdentitySchema>;
