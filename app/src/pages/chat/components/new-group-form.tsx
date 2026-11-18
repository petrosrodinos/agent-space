import { useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { NewChatStepLayout, type NewChatStepProps } from "@/components/layout/new-chat/new-chat-step";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useCreateConversation } from "@/features/conversations/hooks/use-conversations";
import { useMe } from "@/features/users/hooks/use-users";
import { BotColorOptions, DEFAULT_GROUP_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { ColorSwatches, EmojiPicker } from "@/pages/bots/components/bot-pickers";
import { newGroupSchema, type NewGroupFormData } from "../validation-schemas/group.schema";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";

const FORM_ID = "new-group";

/** "New group" step of the new-chat modal (§7.1): any mix of bots and people from the organisation, with a lead bot. */
export const NewGroupForm: FC<NewChatStepProps> = ({ onDone, onBack, closeRef }) => {
  const { data: bots } = useBots();
  const { data: members } = useMembers();
  const { data: me } = useMe();
  const create = useCreateConversation();
  const navigate = useNavigate();
  const form = useForm<NewGroupFormData>({
    resolver: zodResolver(newGroupSchema),
    defaultValues: {
      name: "",
      emoji: DEFAULT_GROUP_EMOJI,
      color: BotColorOptions[0].id,
      bot_ids: [],
      user_ids: [],
    },
  });
  const { requestClose, requestLeave, dialogProps } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    disabled: create.isPending,
    onClose: onDone,
  });

  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);
  const botIds = form.watch("bot_ids");
  const color = form.watch("color");
  const others = (members ?? []).filter((m) => m.user.id !== me?.user.id);

  return (
    <NewChatStepLayout
      title="New group"
      description="Bring bots and colleagues together. Talk to a bot with @name, otherwise the lead bot answers."
      onBack={onBack && (() => requestLeave(onBack))}
      footer={
        <>
          <Button variant="outline" className="rounded-full" onClick={requestClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full" loading={create.isPending}>
            Create group
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          className="space-y-4"
          onSubmit={form.handleSubmit((v) =>
            create.mutate(
              {
                type: ConversationTypes.GROUP,
                name: v.name,
                emoji: v.emoji,
                color: v.color,
                bot_ids: v.bot_ids,
                user_ids: v.user_ids,
                lead_bot_id: v.lead_bot_id ?? v.bot_ids[0],
              },
              {
                onSuccess: (c) => {
                  onDone();
                  navigate(Routes.chat.conversation(c.id));
                },
              },
            ),
          )}
        >
          <div className="flex items-center gap-4">
            <FormField control={form.control} name="emoji" render={({ field }) => <EmojiPicker value={field.value} color={color} onChange={field.onChange} />} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Q4 Launch" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Colour</FormLabel>
                <ColorSwatches value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bot_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bots</FormLabel>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(bots ?? []).map((b) => (
                    <label key={b.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md border border-hairline px-2.5 hover:bg-surface-sunken">
                      <Checkbox checked={field.value.includes(b.id)} onCheckedChange={(v) => field.onChange(v ? [...field.value, b.id] : field.value.filter((x) => x !== b.id))} />
                      <BotAvatar emoji={b.emoji} color={b.color} size={24} />
                      <span className="truncate text-sm font-semibold">{b.name}</span>
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {botIds.length > 1 && (
            <FormField
              control={form.control}
              name="lead_bot_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead bot</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {(bots ?? [])
                      .filter((b) => botIds.includes(b.id))
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => field.onChange(b.id)}
                          className={cn(
                            "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold",
                            (field.value ?? botIds[0]) === b.id ? "border-primary bg-primary-soft" : "border-hairline",
                          )}
                        >
                          {b.emoji} {b.name}
                        </button>
                      ))}
                  </div>
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="user_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>People</FormLabel>
                {others.length ? (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {others.map((m) => (
                      <label key={m.user.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md border border-hairline px-2.5 hover:bg-surface-sunken">
                        <Checkbox checked={field.value.includes(m.user.id)} onCheckedChange={(v) => field.onChange(v ? [...field.value, m.user.id] : field.value.filter((x) => x !== m.user.id))} />
                        <PersonAvatar name={m.user.name} email={m.user.email} size={24} />
                        <span className="truncate text-sm font-semibold">{m.user.name ?? m.user.email}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No one else in this organisation yet — invite colleagues from Settings → Members.</p>
                )}
              </FormItem>
            )}
          />
        </form>
      </Form>
      <UnsavedChangesDialog {...dialogProps} />
    </NewChatStepLayout>
  );
};
