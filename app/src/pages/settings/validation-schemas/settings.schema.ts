import { z } from "zod";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  job_title: z.string().max(120),
  about_me: z.string().max(2000),
  timezone: z.string().min(1).max(64),
  work_start: hhmm,
  work_end: hhmm,
  work_days: z.array(z.number().int().min(0).max(6)),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  company_instructions: z.string().max(8000),
  default_timezone: z.string().max(64),
  auto_join_domain: z.string().trim().max(120).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$|^$/i, "Use a domain like company.com"),
});
export type OrganizationFormValues = z.infer<typeof organizationSchema>;

export const inviteSchema = z.object({
  emails: z
    .string()
    .trim()
    .min(3, "Add at least one email")
    .refine((v) => v.split(/[\s,;]+/).filter(Boolean).every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)), "One or more emails look wrong"),
  role: z.enum(OrgRoles),
});
export type InviteFormValues = z.infer<typeof inviteSchema>;

export const quietHoursSchema = z.object({ start: hhmm, end: hhmm });
