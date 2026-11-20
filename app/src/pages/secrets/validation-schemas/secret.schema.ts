import { z } from "zod";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";
import { SecretKinds } from "@/features/conversations/interfaces/conversations.interfaces";

/** What the Secrets page can add: an access key, a website login the bot types on its cloud computer, or a 1Password Connect server that supplies logins. */
export const AddSecretKinds = { API_KEY: SecretKinds.API_KEY, WEBSITE_LOGIN: SecretKinds.WEBSITE_LOGIN, PASSWORD_MANAGER: SecretKinds.PASSWORD_MANAGER } as const;

const SERVER_URL = /^https?:\/\/[^\s/]+(\/\S*)?$/i;

const WEBSITE = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(\/.*)?$/i;
const TOTP = /^(otpauth:\/\/.+|[A-Za-z2-7\s=-]{16,})$/;

export const addSecretSchema = z
  .object({
    kind: z.enum(AddSecretKinds),
    label: z.string().trim().min(1, "Give it a name").max(80),
    service_name: z.string().trim().max(60),
    value: z.string().min(1, "Required").max(8000),
    website: z.string().trim().max(253),
    username: z.string().trim().max(320),
    totp_secret: z.string().trim().max(1000),
    server_url: z.string().trim().max(500),
    visibility: z.enum(Visibilities),
  })
  .superRefine((v, ctx) => {
    if (v.kind === AddSecretKinds.API_KEY) {
      if (v.value.trim().length < 6) ctx.addIssue({ code: "custom", path: ["value"], message: "That looks too short" });
      return;
    }
    if (v.kind === AddSecretKinds.PASSWORD_MANAGER) {
      if (!SERVER_URL.test(v.server_url)) ctx.addIssue({ code: "custom", path: ["server_url"], message: "Enter the server address, e.g. https://op-connect.acme.com" });
      if (v.value.trim().length < 20) ctx.addIssue({ code: "custom", path: ["value"], message: "Paste the Connect access token" });
      return;
    }
    if (!WEBSITE.test(v.website)) ctx.addIssue({ code: "custom", path: ["website"], message: "Enter the website, e.g. portal.acme.com" });
    if (!v.username) ctx.addIssue({ code: "custom", path: ["username"], message: "Enter the username or email" });
    if (v.totp_secret && !TOTP.test(v.totp_secret)) ctx.addIssue({ code: "custom", path: ["totp_secret"], message: "Paste the setup key (letters and 2–7) or an otpauth:// link" });
  });
export type AddSecretFormValues = z.infer<typeof addSecretSchema>;

export const renameSecretSchema = z.object({
  label: z.string().trim().min(1, "Required").max(80),
  service_name: z.string().trim().max(60),
});
export type RenameSecretFormValues = z.infer<typeof renameSecretSchema>;

export const replaceSecretSchema = z.object({ value: z.string().trim().min(6, "That looks too short").max(8000) });
export type ReplaceSecretFormValues = z.infer<typeof replaceSecretSchema>;

/** Website logins: a new password; username and authenticator key are only changed when filled in. */
export const replaceLoginSchema = z.object({
  value: z.string().min(1, "Enter the new password").max(8000),
  username: z.string().trim().max(320),
  totp_secret: z.string().trim().max(1000).refine((v) => !v || TOTP.test(v), "Paste the setup key (letters and 2–7) or an otpauth:// link"),
  remove_totp: z.boolean(),
});
export type ReplaceLoginFormValues = z.infer<typeof replaceLoginSchema>;
