import { z } from "zod";
import { AVATAR_SEED_REGEX } from "@/lib/avatar-seed";
import { ReplyLanguageChoices, Creativities, BotClarifyingModes, GroupResponseModes, InteractiveRepliesModes, MemoryScopes, BotVisibilities, BotEditPolicies, MaxTaskDurations } from "@/features/bots/interfaces/bots.interfaces";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");
const avatarSeed = z.string().regex(AVATAR_SEED_REGEX, "Pick an avatar");

export const botFormSchema = z.object({
  name: z.string().trim().min(1, "Give your bot a name").max(60),
  avatar_seed: avatarSeed,
  color: hex,
  description: z.string().max(160).optional(),
  instructions: z.string().trim().min(10, "Describe the bot's role in a sentence or two").max(20000),
  model_id: z.string().nullable(),
});
export type BotFormValues = z.infer<typeof botFormSchema>;

/** Quick-create modal: identity only, the rest uses API defaults. */
export const quickBotSchema = botFormSchema.pick({ name: true, avatar_seed: true, color: true });
export type QuickBotFormValues = z.infer<typeof quickBotSchema>;

export const describeBotSchema = z.object({
  description: z.string().trim().min(5, "Tell me a bit more about what the bot should do").max(2000),
});
export type DescribeBotFormValues = z.infer<typeof describeBotSchema>;

export const identitySchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  avatar_seed: avatarSeed,
  color: hex,
  description: z.string().max(160),
  welcome_message: z.string().max(1000),
  starters: z.array(z.object({ value: z.string().max(200) })).max(4),
});
export type IdentityFormValues = z.infer<typeof identitySchema>;

export const behaviourSchema = z.object({
  instructions: z.string().trim().min(10, "Add a little more detail").max(20000),
  model_id: z.string().nullable(),
  creativity: z.enum(Creativities),
  style_override: z.boolean(),
  lock_style: z.boolean(),
  reply_length: z.string(),
  reply_tone: z.string(),
  reply_formatting: z.string(),
  emoji_usage: z.string(),
  reply_language: z.enum(ReplyLanguageChoices),
  clarifying_questions: z.enum(BotClarifyingModes),
  group_response: z.enum(GroupResponseModes),
});
export type BehaviourFormValues = z.infer<typeof behaviourSchema>;

export const abilitiesSchema = z.object({
  web_search_enabled: z.boolean(),
  document_creation_enabled: z.boolean(),
  interactive_replies_mode: z.enum(InteractiveRepliesModes),
  memory_enabled: z.boolean(),
  memory_scope: z.enum(MemoryScopes),
  can_ask_other_bots: z.boolean(),
  can_be_asked: z.boolean(),
  is_sensitive: z.boolean(),
  use_skills_automatically: z.boolean(),
  org_knowledge_enabled: z.boolean(),
});
export type AbilitiesFormValues = z.infer<typeof abilitiesSchema>;

export const sharingSchema = z.object({
  visibility: z.enum(BotVisibilities),
  edit_policy: z.enum(BotEditPolicies),
  max_task_duration: z.enum(MaxTaskDurations),
  monthly_usage_limit: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter an amount like 25 or 12.50"),
});
export type SharingFormValues = z.infer<typeof sharingSchema>;
