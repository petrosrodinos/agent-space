import { z } from "zod";
import { ToolServerAuthKinds } from "@/features/tool-servers/interfaces/tool-servers.interfaces";
import { UrlProtocols } from "@/config/constants/browser.constants";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";

const url = z
  .string()
  .trim()
  .min(1, "Enter the server address")
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === UrlProtocols.HTTPS || (u.protocol === UrlProtocols.HTTP && /^(localhost|127\.0\.0\.1)$/.test(u.hostname));
    } catch {
      return false;
    }
  }, "Enter a full https address, e.g. https://tools.example.com/mcp");

export const toolServerSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(80),
    url,
    auth_kind: z.enum(ToolServerAuthKinds),
    token: z.string().trim().max(8000).optional(),
    visibility: z.enum(Visibilities),
  })
  .refine((v) => v.auth_kind !== ToolServerAuthKinds.TOKEN || (v.token?.length ?? 0) >= 4, { path: ["token"], message: "Paste the access token" });
export type ToolServerFormValues = z.infer<typeof toolServerSchema>;

export const editToolServerSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  url,
  token: z.string().trim().max(8000).optional(),
});
export type EditToolServerFormValues = z.infer<typeof editToolServerSchema>;
