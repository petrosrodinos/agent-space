import type { FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsCard } from "@/components/ui/setting-row";
import type { Skill, SkillFormDto } from "@/features/skills/interfaces/skills.interfaces";
import { skillFormSchema, type SkillFormValues } from "../validation-schemas/skill.schema";
import { DEFAULT_SKILL_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";

export function toFormValues(s?: Skill): SkillFormValues {
  return {
    name: s?.name ?? "",
    emoji: s?.emoji ?? DEFAULT_SKILL_EMOJI,
    slug: s?.slug ?? "",
    description: s?.description ?? "",
    instructions: s?.instructions ?? "",
    questions: (s?.questions ?? []).map((q) => ({ question: q.question, required: q.required !== false })),
    required_services: (s?.required_tools ?? []).map((t) => t.service_key).join(", "),
    result: s?.result ?? "",
    change_summary: "",
  };
}

export function toDto(v: SkillFormValues): SkillFormDto {
  return {
    name: v.name,
    emoji: v.emoji || undefined,
    slug: v.slug || undefined,
    description: v.description,
    instructions: v.instructions,
    questions: v.questions.filter((q) => q.question.trim()).map((q, i) => ({ key: `q${i + 1}`, question: q.question.trim(), required: q.required })),
    required_services: v.required_services.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    result: v.result || undefined,
    change_summary: v.change_summary || undefined,
  };
}

interface SkillFormProps {
  defaultValues: SkillFormValues;
  readOnly?: boolean;
  isNew?: boolean;
  loading?: boolean;
  onSubmit: (v: SkillFormValues) => void;
}

export const SkillForm: FC<SkillFormProps> = ({ defaultValues, readOnly, isNew, loading, onSubmit }) => {
  const form = useForm<SkillFormValues>({ resolver: zodResolver(skillFormSchema), defaultValues, values: defaultValues });
  const questions = useFieldArray({ control: form.control, name: "questions" });
  const ro = !!readOnly;
  const text = (name: "name" | "emoji" | "slug" | "result" | "required_services" | "change_summary", label: string, opts: { placeholder?: string; description?: string; prefix?: string } = {}) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              {opts.prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">{opts.prefix}</span>}
              <Input disabled={ro} placeholder={opts.placeholder} className={opts.prefix ? "pl-7" : undefined} {...field} />
            </div>
          </FormControl>
          {opts.description && <FormDescription>{opts.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <SettingsCard title={isNew ? "New skill" : "Skill"}>
          <div className="space-y-5 py-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              {text("emoji", "Emoji")}
              {text("name", "Name", { placeholder: "Client onboarding" })}
            </div>
            {text("slug", "Short name", { prefix: "/", placeholder: "client-onboarding", description: isNew ? "Leave empty to create it from the name." : "Used to mention the skill in chat." })}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When to use it</FormLabel>
                  <FormControl>
                    <Textarea rows={2} disabled={ro} placeholder="Use when a new client signs, to run the standard onboarding steps." {...field} />
                  </FormControl>
                  <FormDescription>Bots read this to decide when the skill applies.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps and rules</FormLabel>
                  <FormControl>
                    <Textarea rows={10} disabled={ro} placeholder={"1. Create the client in the CRM\n2. Set up a shared folder\n3. …"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Questions to ask first</p>
              <div className="space-y-2">
                {questions.fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <FormField control={form.control} name={`questions.${i}.question`} render={({ field }) => <Input disabled={ro} placeholder="What is the client's name?" {...field} aria-label={`Question ${i + 1}`} />} />
                    <FormField
                      control={form.control}
                      name={`questions.${i}.required`}
                      render={({ field }) => (
                        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} disabled={ro} /> Required
                        </label>
                      )}
                    />
                    {!ro && (
                      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => questions.remove(i)} aria-label="Remove question">
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                {!ro && (
                  <Button type="button" variant="outline" size="sm" onClick={() => questions.append({ question: "", required: true })}>
                    <Plus /> Add question
                  </Button>
                )}
              </div>
            </div>
            {text("required_services", "Tools and connections needed", { placeholder: "hubspot, gmail, googledrive", description: "Comma-separated. The bot asks the user to connect anything missing." })}
            {text("result", "Result", { placeholder: "CRM record, shared folder, welcome email and kick-off booked" })}
            {!isNew && !ro && text("change_summary", "What changed (optional)", { placeholder: "Added a step to create a Slack channel" })}
          </div>
          {!ro && (
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={loading} disabled={!isNew && !form.formState.isDirty}>
                {isNew ? "Create skill" : "Save as new version"}
              </Button>
            </div>
          )}
        </SettingsCard>
      </form>
    </Form>
  );
};
