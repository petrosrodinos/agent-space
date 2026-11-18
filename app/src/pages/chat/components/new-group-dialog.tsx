import { type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useCreateConversation } from "@/features/conversations/hooks/use-conversations";
import { useMe } from "@/features/users/hooks/use-users";
import { BotEmojiSuggestions, DEFAULT_GROUP_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { newGroupSchema, type NewGroupFormData } from "../validation-schemas/group.schema";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";

/** §7.1 Group: any mix of bots and people from the organisation, with a lead bot. */
export const NewGroupDialog: FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const { data: bots } = useBots();
  const { data: members } = useMembers();
  const { data: me } = useMe();
  const create = useCreateConversation();
  const navigate = useNavigate();
  const form = useForm<NewGroupFormData>({ resolver: zodResolver(newGroupSchema), defaultValues: { name: "", emoji: DEFAULT_GROUP_EMOJI, bot_ids: [], user_ids: [] } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    disabled: create.isPending,
    onClose: () => {
      form.reset();
      onOpenChange(false);
    },
  });
  const botIds = form.watch("bot_ids");
  const others = (members ?? []).filter((m) => m.user.id !== me?.user.id);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>Bring bots and colleagues together. Talk to a bot with @name — otherwise the lead bot answers.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="new-group"
              className="max-h-[60vh] space-y-4 overflow-y-auto pr-1"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(
                  { type: ConversationTypes.GROUP, name: v.name, emoji: v.emoji, bot_ids: v.bot_ids, user_ids: v.user_ids, lead_bot_id: v.lead_bot_id ?? v.bot_ids[0] },
                  {
                    onSuccess: (c) => {
                      form.reset();
                      onOpenChange(false);
                      navigate(Routes.chat.conversation(c.id));
                    },
                  },
                ),
              )}
            >
              <div className="flex gap-3">
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
                name="emoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emoji</FormLabel>
                    <div className="flex flex-wrap gap-1">
                      {BotEmojiSuggestions.slice(0, 16).map((e) => (
                        <button key={e} type="button" onClick={() => field.onChange(e)} className={cn("inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-xl", field.value === e ? "bg-primary-soft ring-2 ring-primary" : "hover:bg-surface-sunken")} aria-label={`Emoji ${e}`} aria-pressed={field.value === e}>
                          {e}
                        </button>
                      ))}
                    </div>
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
                        <label key={b.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[12px] border border-hairline px-2.5 hover:bg-surface-sunken">
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
                            <button key={b.id} type="button" onClick={() => field.onChange(b.id)} className={cn("inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold", (field.value ?? botIds[0]) === b.id ? "border-primary bg-primary-soft" : "border-hairline")}>
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
                          <label key={m.user.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[12px] border border-hairline px-2.5 hover:bg-surface-sunken">
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="new-group" loading={create.isPending}>
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};
