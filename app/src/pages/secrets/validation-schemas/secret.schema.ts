import { z } from "zod";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";

export const addSecretSchema = z.object({
  label: z.string().trim().min(1, "Give it a name").max(80),
  service_name: z.string().trim().max(60),
  value: z.string().trim().min(6, "That looks too short").max(8000),
  visibility: z.enum(Visibilities),
});
export type AddSecretFormValues = z.infer<typeof addSecretSchema>;

export const renameSecretSchema = z.object({
  label: z.string().trim().min(1, "Required").max(80),
  service_name: z.string().trim().max(60),
});
export type RenameSecretFormValues = z.infer<typeof renameSecretSchema>;

export const replaceSecretSchema = z.object({ value: z.string().trim().min(6, "That looks too short").max(8000) });
export type ReplaceSecretFormValues = z.infer<typeof replaceSecretSchema>;
