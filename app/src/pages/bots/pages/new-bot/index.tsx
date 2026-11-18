import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LayoutTemplate, PenLine, Wand2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useCreateBot, useDraftBot, useTemplates } from "@/features/bots/hooks/use-bots";
import { useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import type { BotDraft, BotTemplate } from "@/features/bots/interfaces/bots.interfaces";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { BotForm } from "../../components/bot-form";
import { describeBotSchema, type BotFormValues, type DescribeBotFormValues } from "../../validation-schemas/bot.schema";
import { DEFAULT_BOT_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";

const CreateModes = { TEMPLATE: "template", DESCRIBE: "describe", FORM: "form" } as const;
type Mode = (typeof CreateModes)[keyof typeof CreateModes];
const MODES: { id: Mode; label: string }[] = [
  { id: CreateModes.TEMPLATE, label: "Templates" },
  { id: CreateModes.DESCRIBE, label: "Describe it" },
  { id: CreateModes.FORM, label: "From scratch" },
];

const DEFAULTS: BotFormValues = { name: "", emoji: DEFAULT_BOT_EMOJI, color: "#6B4EFF", description: "", instructions: "", model_id: null };

const NewBotPage: FC = () => {
  const [mode, setMode] = useState<Mode>(CreateModes.TEMPLATE);
  const [picked, setPicked] = useState<BotTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [draft, setDraft] = useState<BotDraft | null>(null);
  const { data: templates, isPending } = useTemplates();
  const create = useCreateBot();
  const draftBot = useDraftBot();
  const openDirect = useOpenDirect();
  const navigate = useNavigate();
  const describeForm = useForm<DescribeBotFormValues>({ resolver: zodResolver(describeBotSchema), defaultValues: { description: "" } });

  const finish = (botId: string) => openDirect.mutate({ bot_id: botId }, { onSuccess: (c) => navigate(Routes.chat.conversation(c.id), { replace: true }) });

  const createFromValues = (v: BotFormValues, template_id?: string | null) =>
    create.mutate({ ...v, description: v.description || null, template_id: template_id ?? undefined }, { onSuccess: (bot) => finish(bot.id) });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-3 hidden md:inline-flex" onClick={() => navigate(Routes.bots.root)}>
        <ArrowLeft /> Bots
      </Button>
      <PageHeader backTo={Routes.bots.root} title="Create a bot" description="Start from a template, describe what you need, or build it yourself." />
      <SegmentedControl ariaLabel="How to create the bot" value={mode} options={MODES} onChange={(m) => setMode(m)} className="mb-6" />

      {mode === CreateModes.TEMPLATE && (
        <>
          {isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPicked(t);
                    setTemplateName(t.name);
                  }}
                  className={cn("card-lift flex flex-col rounded-lg border bg-surface p-4 text-left shadow-sticker", picked?.id === t.id ? "border-primary ring-2 ring-primary/30" : "border-hairline")}
                >
                  <div className="flex items-center gap-3">
                    <BotAvatar emoji={t.emoji} color={t.color} size={56} name={t.name} />
                    <div className="min-w-0">
                      <p className="text-[17px] font-bold text-ink">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.model?.name ?? "Recommended"}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-body">{t.description}</p>
                  {t.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {t.skills.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                          {s.emoji} {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {picked && (
            <div className="sticky bottom-20 mt-6 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-pop sm:flex-row sm:items-end md:bottom-4">
              <div className="flex-1">
                <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-bold text-ink">
                  Name your {picked.name} bot
                </label>
                <Input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={60} />
              </div>
              <Button
                size="lg"
                loading={create.isPending || openDirect.isPending}
                disabled={!templateName.trim()}
                onClick={() => create.mutate({ name: templateName.trim(), template_id: picked.id }, { onSuccess: (bot) => finish(bot.id) })}
              >
                <LayoutTemplate /> Create bot
              </Button>
            </div>
          )}
        </>
      )}

      {mode === CreateModes.DESCRIBE && (
        <div className="max-w-[720px] rounded-lg border border-hairline bg-surface p-5 shadow-sticker sm:p-6">
          {!draft ? (
            <Form {...describeForm}>
              <form onSubmit={describeForm.handleSubmit((v) => draftBot.mutate(v.description, { onSuccess: setDraft }))} className="space-y-4">
                <FormField
                  control={describeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What should your bot do?</FormLabel>
                      <FormControl>
                        <Textarea rows={5} placeholder="Make me a sales assistant that preps me for calls and keeps HubSpot updated" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={draftBot.isPending}>
                    <Wand2 /> Draft my bot
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">Here's a draft. Adjust anything, then create it.</p>
              <BotForm
                defaultValues={{ name: draft.name, emoji: draft.emoji, color: draft.color, description: draft.description, instructions: draft.instructions, model_id: draft.model_id }}
                submitLabel="Create bot"
                loading={create.isPending || openDirect.isPending}
                onBack={() => setDraft(null)}
                onSubmit={(v) => createFromValues(v, draft.template_id)}
              />
            </>
          )}
        </div>
      )}

      {mode === CreateModes.FORM && (
        <div className="max-w-[720px] rounded-lg border border-hairline bg-surface p-5 shadow-sticker sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <PenLine className="h-4 w-4" /> Everything can be changed later in the bot's settings — or just by asking it.
          </div>
          <BotForm defaultValues={DEFAULTS} submitLabel="Create bot" loading={create.isPending || openDirect.isPending} onSubmit={(v) => createFromValues(v)} />
        </div>
      )}
    </PageContainer>
  );
};

export default NewBotPage;
