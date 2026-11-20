import { z } from "zod";

/** A tool server (MCP) that runs on this computer (§14.3). Env values are write-only. */
export const localToolServerSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  command: z.string().trim().min(1, "Enter the command that starts it").max(500),
  args: z.string().max(4000),
  env: z
    .string()
    .max(8000)
    .refine((v) => v.split("\n").every((l) => !l.trim() || /^[A-Za-z_][A-Za-z0-9_]*=/.test(l.trim())), "One NAME=value per line"),
  enabled: z.boolean(),
});

export type LocalToolServerFormValues = z.infer<typeof localToolServerSchema>;
