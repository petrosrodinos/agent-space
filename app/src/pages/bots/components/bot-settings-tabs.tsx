import { VoicePicker } from "@/components/layout/voice-picker";
import { useEffect, useMemo, useState, type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { StatusPill } from "@/components/ui/status-pill";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionType, Bot } from "@/features/bots/interfaces/bots.interfaces";
import { useAddBotMemory, useBotMemories, useClearBotMemories, useDeleteMemory, useSetApprovalRules, useSetBotConnections, useUpdateBot, useUpdateMemory } from "@/features/bots/hooks/use-bots";
import { useConnections } from "@/features/connections/hooks/use-connections";
import { useSetBotSkills, useSkills } from "@/features/skills/hooks/use-skills";
import {
  ActionTypeOptions, ApprovalLevelFormOptions, ApprovalOverrideOptions, BotClarifyingOptions, BotEditPolicyOptions, BotReplyLanguageOptions, BotVisibilityOptions,
  CreativityOptions, EmojiUsageOptions, GroupResponseOptions, InteractiveRepliesOptions, MaxTaskDurationOptions, MemoryScopeOptions, ReplyFormattingOptions, ReplyLengthOptions,
  ReplyToneOptions,
} from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import {
  abilitiesSchema, behaviourSchema, identitySchema, sharingSchema, type AbilitiesFormValues, type BehaviourFormValues, type IdentityFormValues, type SharingFormValues,
} from "../validation-schemas/bot.schema";
import { AvatarPicker, ColorSwatches, ModelSelect } from "./bot-pickers";
import { SaveBar, SelectField, SwitchField } from "./form-fields";
import { ReplyLanguageChoices, ActionTypes, MemoryKinds, ApprovalOverrideChoices, type ApprovalOverrideChoice } from "@/features/bots/interfaces/bots.interfaces";
import { ConnectionStatuses } from "@/features/connections/interfaces/connections.interfaces";
import { SkillTabs } from "@/features/skills/interfaces/skills.interfaces";
import { ReplyLengths, ReplyTones, ReplyFormattings, EmojiUsages } from "@/features/users/interfaces/users.interfaces";

interface TabProps {
  bot: Bot;
  isAdmin: boolean;
}

export const IdentityTab: FC<TabProps> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const ro = !bot.can_edit;
  const defaults = useMemo<IdentityFormValues>(
    () => ({ name: bot.name, avatar_seed: bot.avatar_seed, color: bot.color, description: bot.description ?? "", welcome_message: bot.welcome_message ?? "", starters: bot.conversation_starters.map((value) => ({ value })) }),
    [bot],
  );
  const form = useForm<IdentityFormValues>({ resolver: zodResolver(identitySchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [defaults, form]);
  const starters = useFieldArray({ control: form.control, name: "starters" });
  const color = form.watch("color");
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          update.mutate({ name: v.name, avatar_seed: v.avatar_seed, color: v.color, description: v.description || null, welcome_message: v.welcome_message || null, conversation_starters: v.starters.map((s) => s.value.trim()).filter(Boolean) }),
        )}
      >
        <SettingsCard title="Identity" description="How the bot looks in chats and lists.">
          <div className="space-y-5 py-3">
            <div className="flex items-center gap-4">
              <FormField control={form.control} name="avatar_seed" render={({ field }) => <AvatarPicker value={field.value} color={color} onChange={field.onChange} disabled={ro} />} />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input disabled={ro} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField control={form.control} name="color" render={({ field }) => <FormItem><FormLabel>Colour</FormLabel><ColorSwatches value={field.value} onChange={field.onChange} disabled={ro} /></FormItem>} />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input disabled={ro} placeholder="One line shown in lists" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="welcome_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Welcome message</FormLabel>
                  <FormControl>
                    <Textarea disabled={ro} rows={2} placeholder="Shown when someone starts a new chat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Conversation starters <span className="font-medium text-muted-foreground">(up to 4)</span></p>
              <div className="space-y-2">
                {starters.fields.map((f, i) => (
                  <div key={f.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`starters.${i}.value`}
                      render={({ field }) => (
                        <div className="min-w-0 flex-1">
                          <Textarea disabled={ro} rows={2} placeholder="e.g. What can you help me with?" className="min-h-[64px] resize-y" {...field} aria-label={`Starter ${i + 1}`} />
                        </div>
                      )}
                    />
                    {!ro && (
                      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => starters.remove(i)} aria-label={`Remove starter ${i + 1}`}>
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                {!ro && starters.fields.length < 4 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => starters.append({ value: "" })}>
                    <Plus /> Add starter
                  </Button>
                )}
              </div>
            </div>
          </div>
          <SaveBar dirty={form.formState.isDirty} loading={update.isPending} readOnly={ro} />
        </SettingsCard>
      </form>
    </Form>
  );
};

export const BehaviourTab: FC<TabProps> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const ro = !bot.can_edit;
  const defaults = useMemo<BehaviourFormValues>(
    () => ({
      instructions: bot.instructions,
      model_id: bot.model_id,
      creativity: bot.creativity,
      style_override: bot.style_override,
      lock_style: bot.lock_style,
      reply_length: bot.reply_length ?? ReplyLengths.BALANCED,
      reply_tone: bot.reply_tone ?? ReplyTones.FRIENDLY_PROFESSIONAL,
      reply_formatting: bot.reply_formatting ?? ReplyFormattings.MIXED,
      emoji_usage: bot.emoji_usage ?? EmojiUsages.OCCASIONALLY,
      reply_language: bot.reply_language ?? ReplyLanguageChoices.SAME,
      clarifying_questions: bot.clarifying_questions,
      group_response: bot.group_response,
    }),
    [bot],
  );
  const form = useForm<BehaviourFormValues>({ resolver: zodResolver(behaviourSchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [defaults, form]);
  const override = form.watch("style_override");
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          update.mutate({
            instructions: v.instructions,
            model_id: v.model_id,
            creativity: v.creativity,
            style_override: v.style_override,
            lock_style: v.style_override ? v.lock_style : false,
            reply_length: v.style_override ? v.reply_length : null,
            reply_tone: v.style_override ? v.reply_tone : null,
            reply_formatting: v.style_override ? v.reply_formatting : null,
            emoji_usage: v.style_override ? v.emoji_usage : null,
            reply_language: v.reply_language === ReplyLanguageChoices.SAME ? null : v.reply_language,
            clarifying_questions: v.clarifying_questions,
            group_response: v.group_response,
          }),
        )}
      >
        <SettingsCard title="Behaviour" description="What the bot does and how it replies.">
          <div className="space-y-5 py-3">
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea rows={10} disabled={ro} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="model_id" render={({ field }) => <FormItem><FormLabel>AI model</FormLabel><ModelSelect value={field.value} onChange={field.onChange} disabled={ro} /></FormItem>} />
          </div>
          <SelectField control={form.control} name="creativity" label="Creativity" options={CreativityOptions} disabled={ro} />
          <SelectField control={form.control} name="reply_language" label="Reply language" options={BotReplyLanguageOptions} disabled={ro} />
          <SelectField control={form.control} name="clarifying_questions" label="Clarifying questions" options={BotClarifyingOptions} disabled={ro} />
          <SelectField control={form.control} name="group_response" label="Response in groups" options={GroupResponseOptions} disabled={ro} />
          <SwitchField control={form.control} name="style_override" label="Set a reply style for this bot" description="Otherwise each user's personal preferences are used." disabled={ro} />
          {override && (
            <>
              <SelectField control={form.control} name="reply_length" label="Reply length" options={ReplyLengthOptions} disabled={ro} />
              <SelectField control={form.control} name="reply_tone" label="Tone" options={ReplyToneOptions} disabled={ro} />
              <SelectField control={form.control} name="reply_formatting" label="Formatting" options={ReplyFormattingOptions} disabled={ro} />
              <SelectField control={form.control} name="emoji_usage" label="Emoji" options={EmojiUsageOptions} disabled={ro} />
              <SwitchField control={form.control} name="lock_style" label="Lock style" description="The bot's style overrides each user's preferences (e.g. a Support bot that must stay formal)." disabled={ro} />
            </>
          )}
          <SaveBar dirty={form.formState.isDirty} loading={update.isPending} readOnly={ro} />
        </SettingsCard>
      </form>
    </Form>
  );
};

export const AbilitiesTab: FC<TabProps> = ({ bot, isAdmin }) => {
  const update = useUpdateBot(bot.id);
  const ro = !bot.can_edit;
  const defaults = useMemo<AbilitiesFormValues>(
    () => ({
      web_search_enabled: bot.web_search_enabled,
      document_creation_enabled: bot.document_creation_enabled,
      interactive_replies_mode: bot.interactive_replies_mode,
      memory_enabled: bot.memory_enabled,
      memory_scope: bot.memory_scope,
      can_ask_other_bots: bot.can_ask_other_bots,
      can_be_asked: bot.can_be_asked,
      is_sensitive: bot.is_sensitive,
      use_skills_automatically: bot.use_skills_automatically,
      org_knowledge_enabled: bot.org_knowledge_enabled,
    }),
    [bot],
  );
  const form = useForm<AbilitiesFormValues>({ resolver: zodResolver(abilitiesSchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [defaults, form]);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => update.mutate(v))}>
        <SettingsCard title="Abilities" description="What the bot may use.">
          <SwitchField control={form.control} name="web_search_enabled" label="Web search" disabled={ro} />
          <SwitchField control={form.control} name="document_creation_enabled" label="Create documents and files" disabled={ro} />
          <SelectField control={form.control} name="interactive_replies_mode" label="Interactive replies" options={InteractiveRepliesOptions} disabled={ro} />
          <SwitchField control={form.control} name="use_skills_automatically" label="Use skills automatically" description="Off means skills are only used when mentioned with /." disabled={ro} />
          <SwitchField control={form.control} name="org_knowledge_enabled" label="Organisation knowledge" description="Use company facts and the knowledge library." disabled={ro} />
          <SwitchField control={form.control} name="memory_enabled" label="Memory" disabled={ro} />
          <SelectField control={form.control} name="memory_scope" label="Memory scope" options={MemoryScopeOptions} disabled={ro} />
          <SwitchField control={form.control} name="can_ask_other_bots" label="Can ask other bots for help" disabled={ro} />
          <SwitchField control={form.control} name="can_be_asked" label="Other bots can ask this bot" disabled={ro} />
          <SwitchField control={form.control} name="is_sensitive" label="Sensitive" description={isAdmin ? "Other bots need the user's approval before asking this bot for information." : "Only Owners and Admins can change this."} disabled={ro || !isAdmin} />
          <SaveBar dirty={form.formState.isDirty} loading={update.isPending} readOnly={ro} />
        </SettingsCard>
      </form>
      <SettingsCard title="Voice mode" description="Talk with this bot out loud, in real time, with the same tools and approvals as in chat." className="mt-4">
        <SettingRow label="Voice mode">
          <Switch checked={bot.voice_mode_enabled} disabled={ro} onCheckedChange={(v) => update.mutate({ voice_mode_enabled: v })} aria-label="Voice mode" />
        </SettingRow>
        <SettingRow label="Voice" description="People can choose one voice for all bots in their own settings.">
          <VoicePicker value={bot.voice} disabled={ro || !bot.voice_mode_enabled} onChange={(v) => update.mutate({ voice: v })} />
        </SettingRow>
      </SettingsCard>
    </Form>
  );
};

export const ConnectionsTab: FC<TabProps> = ({ bot }) => {
  const { data: connections, isPending } = useConnections();
  const save = useSetBotConnections(bot.id);
  const initial = useMemo(() => new Map((bot.bot_connections ?? []).map((c) => [c.connection_id, c.is_default_for_service])), [bot]);
  const [selected, setSelected] = useState(initial);
  useEffect(() => setSelected(new Map(initial)), [initial]);
  const ro = !bot.can_edit;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initial].sort());
  const toggle = (id: string, on: boolean) => setSelected((m) => { const n = new Map(m); if (on) n.set(id, false); else n.delete(id); return n; });
  const setDefault = (id: string, service: string) =>
    setSelected((m) => {
      const n = new Map(m);
      for (const c of connections ?? []) if (c.service_key === service && n.has(c.id)) n.set(c.id, c.id === id);
      return n;
    });

  return (
    <SettingsCard title="Connections" description="Which connected accounts this bot may use. When none are selected, it can use every account you can use.">
      {isPending ? (
        <div className="space-y-2 py-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : !connections?.length ? (
        <p className="py-4 text-sm text-muted-foreground">No connections yet. Connect accounts on the Connections page.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {connections.map((c) => {
            const on = selected.has(c.id);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <Checkbox id={`conn-${c.id}`} checked={on} disabled={ro} onCheckedChange={(v) => toggle(c.id, !!v)} />
                <label htmlFor={`conn-${c.id}`} className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.service_name}
                    {c.account_identifier ? ` · ${c.account_identifier}` : ""}
                  </span>
                </label>
                <StatusPill tone={c.status === ConnectionStatuses.ACTIVE ? "success" : c.status === ConnectionStatuses.ERROR ? "error" : "warning"}>{getDropdownOptionLabel(ConnectionStatusOptions, c.status)}</StatusPill>
                {on && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Switch checked={!!selected.get(c.id)} disabled={ro} onCheckedChange={(v) => v && setDefault(c.id, c.service_key)} aria-label={`Default for ${c.service_name}`} />
                    Default for {c.service_name}
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!ro && (
        <div className="flex justify-end pt-4">
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate([...selected].map(([connection_id, is_default_for_service]) => ({ connection_id, is_default_for_service })))}>
            Save connections
          </Button>
        </div>
      )}
    </SettingsCard>
  );
};

export const SkillsTab: FC<TabProps> = ({ bot }) => {
  const { data: skills, isPending } = useSkills(SkillTabs.ALL);
  const save = useSetBotSkills();
  const initial = useMemo(() => new Set((bot.bot_skills ?? []).map((s) => s.skill.id)), [bot]);
  const [selected, setSelected] = useState(initial);
  useEffect(() => setSelected(new Set(initial)), [initial]);
  const ro = !bot.can_edit;
  const dirty = [...selected].sort().join() !== [...initial].sort().join();
  return (
    <SettingsCard title="Skills" description="Step-by-step procedures this bot can follow. It picks one when a request matches.">
      {isPending ? (
        <div className="space-y-2 py-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : (
        <div className="divide-y divide-hairline">
          {skills?.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-3 py-3">
              <Checkbox
                checked={selected.has(s.id)}
                disabled={ro}
                onCheckedChange={(v) => setSelected((cur) => { const n = new Set(cur); if (v) n.add(s.id); else n.delete(s.id); return n; })}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
                  {s.emoji} {s.name}
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-accent-foreground">/{s.slug}</span>
                </span>
                <span className="block text-sm text-muted-foreground">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {!ro && (
        <div className="flex justify-end pt-4">
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ botId: bot.id, skill_ids: [...selected] })}>
            Save skills
          </Button>
        </div>
      )}
    </SettingsCard>
  );
};

export const ApprovalsTab: FC<TabProps> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const rules = useSetApprovalRules(bot.id);
  const ro = !bot.can_edit;
  const initial = useMemo(() => Object.fromEntries((bot.approval_rules ?? []).map((r) => [r.action_type, r.override])) as Record<string, string>, [bot]);
  const [overrides, setOverrides] = useState<Record<string, string>>(initial);
  useEffect(() => setOverrides(initial), [initial]);
  const dirty = ActionTypeOptions.some((a) => (overrides[a.id] ?? ApprovalOverrideChoices.DEFAULT) !== (initial[a.id] ?? ApprovalOverrideChoices.DEFAULT));
  return (
    <div className="space-y-4">
      <SettingsCard title="Overall level" description="Which actions need your OK first. Organisation rules always apply.">
        <div className="space-y-2 py-3" role="radiogroup" aria-label="Approval level">
          {ApprovalLevelFormOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={bot.approval_level === o.id}
              disabled={ro || update.isPending}
              onClick={() => update.mutate({ approval_level: o.id })}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors ${bot.approval_level === o.id ? "border-primary bg-primary-soft" : "border-hairline hover:bg-surface-sunken"}`}
            >
              <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${bot.approval_level === o.id ? "border-primary bg-primary" : "border-hairline-strong"}`} />
              <span>
                <span className="block font-bold text-ink">{o.label}</span>
                <span className="block text-sm text-muted-foreground">{o.description}</span>
              </span>
            </button>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Per action type" description="Override the overall level for specific actions.">
        {ActionTypeOptions.filter((a) => a.id !== ActionTypes.OTHER && a.id !== ActionTypes.CONSULT_SENSITIVE_BOT).map((a) => (
          <SettingRow key={a.id} label={a.label}>
            <Select value={overrides[a.id] ?? ApprovalOverrideChoices.DEFAULT} onValueChange={(v) => setOverrides((o) => ({ ...o, [a.id]: v }))} disabled={ro}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label={`Approval for ${a.label}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ApprovalOverrideOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        ))}
        {!ro && (
          <div className="flex justify-end pt-4">
            <Button
              disabled={!dirty}
              loading={rules.isPending}
              onClick={() => rules.mutate(ActionTypeOptions.map((a) => ({ action_type: a.id as ActionType, override: (overrides[a.id] ?? ApprovalOverrideChoices.DEFAULT) as ApprovalOverrideChoice })))}
            >
              Save rules
            </Button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
};

export const MemoryTab: FC<TabProps> = ({ bot }) => {
  const { data: memories, isPending } = useBotMemories(bot.id);
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const clear = useClearBotMemories();
  const add = useAddBotMemory();
  const [fact, setFact] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const addFact = () => fact.trim() && add.mutate({ botId: bot.id, content: fact.trim() }, { onSuccess: () => setFact("") });
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <SettingsCard
      title="Memory"
      description="Useful facts and preferences this bot remembers. You can edit or delete anything."
      actions={
        !!memories?.length && (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
            Clear all
          </Button>
        )
      }
    >
      {isPending ? (
        <div className="space-y-2 py-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : !memories?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing remembered yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start gap-2 py-3">
              {editing?.id === m.id ? (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <Input value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} aria-label="Memory" autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" loading={updateMemory.isPending} disabled={!editing.content.trim()} onClick={() => updateMemory.mutate({ id: m.id, content: editing.content.trim() }, { onSuccess: () => setEditing(null) })}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-ink">{m.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.kind === MemoryKinds.BOT_SHARED ? "Shared" : "About you"} · {timeAgo(m.updated_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing({ id: m.id, content: m.content })} aria-label="Edit memory">
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => deleteMemory.mutate(m.id)} aria-label="Delete memory">
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 pt-3">
        <div className="min-w-0 flex-1">
          <Input placeholder="I prefer replies in bullet points" value={fact} onChange={(e) => setFact(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFact()} aria-label="New memory" />
        </div>
        <Button disabled={!fact.trim()} loading={add.isPending} onClick={addFact}>
          Add
        </Button>
      </div>
      <ConfirmationDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear everything this bot remembers about you?"
        description="This can't be undone."
        confirmText="Clear memories"
        variant="destructive"
        isLoading={clear.isPending}
        onConfirm={() => clear.mutate(bot.id, { onSuccess: () => setConfirmClear(false) })}
      />
    </SettingsCard>
  );
};

export const SharingTab: FC<TabProps> = ({ bot, isAdmin }) => {
  const update = useUpdateBot(bot.id);
  const ro = !bot.can_edit;
  const defaults = useMemo<SharingFormValues>(
    () => ({ visibility: bot.visibility, edit_policy: bot.edit_policy, max_task_duration: bot.max_task_duration, monthly_usage_limit: bot.monthly_usage_limit != null ? String(bot.monthly_usage_limit) : "" }),
    [bot],
  );
  const form = useForm<SharingFormValues>({ resolver: zodResolver(sharingSchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [defaults, form]);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => update.mutate({ ...v, monthly_usage_limit: v.monthly_usage_limit ? Number(v.monthly_usage_limit) : null }))}>
        <SettingsCard title="Sharing and limits">
          <SelectField control={form.control} name="visibility" label="Visibility" description={isAdmin ? "Organisation-wide bots are available to every member." : "Only Owners and Admins can make a bot available to everyone."} options={BotVisibilityOptions} disabled={ro || !isAdmin} />
          <SelectField control={form.control} name="edit_policy" label="Who can edit" options={BotEditPolicyOptions} disabled={ro} />
          <SelectField control={form.control} name="max_task_duration" label="Maximum task duration" options={MaxTaskDurationOptions} disabled={ro} />
          <FormField
            control={form.control}
            name="monthly_usage_limit"
            render={({ field }) => (
              <FormItem>
                <SettingRow label="Monthly usage limit (USD)" description="Leave empty for no limit. Organisation limits still apply.">
                  <FormControl>
                    <Input className="w-full sm:w-[160px]" inputMode="decimal" placeholder="No limit" disabled={ro} {...field} />
                  </FormControl>
                </SettingRow>
                <FormMessage />
              </FormItem>
            )}
          />
          <SaveBar dirty={form.formState.isDirty} loading={update.isPending} readOnly={ro} />
        </SettingsCard>
      </form>
    </Form>
  );
};
