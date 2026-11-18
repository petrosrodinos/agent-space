import { z } from "zod";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";

export const connectSchema = z.object({
  label: z.string().trim().max(80),
  visibility: z.enum(Visibilities),
});
export type ConnectFormValues = z.infer<typeof connectSchema>;

export const apiKeySchema = z.object({
  service_name: z.string().trim().min(1, "Which service is this key for?").max(60),
  label: z.string().trim().min(1, "Give it a name").max(80),
  api_key: z.string().trim().min(6, "That key looks too short").max(8000),
  visibility: z.enum(Visibilities),
});
export type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export const renameSchema = z.object({ label: z.string().trim().min(1, "Required").max(80) });
export type RenameFormValues = z.infer<typeof renameSchema>;
