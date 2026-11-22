import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Crown, Plus, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { randomAvatarSeed } from "@/components/ui/bot-portrait";
import { groupIdentitySchema, type GroupIdentityFormValues } from "../validation-schemas/group.schema";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useAddParticipants, useRemoveParticipant, useUpdateConversation } from "@/features/conversations/hooks/use-conversations";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ConversationTypeOptions } from "@/config/constants/dropdowns/shared/status.options";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { AvatarPicker, ColorSwatches } from "@/pages/bots/components/bot-pickers";
import { BotPanel } from "./bot-panel";

const AddModes = { BOTS: "BOTS", PEOPLE: "PEOPLE" } as const;
type AddMode = (typeof AddModes)[keyof typeof AddModes];

/** Group identity, laid out like a bot's: avatar picker beside the name, colour swatches below, one Save. */
const GroupIdentityForm: FC<{ conversation: Conversation }> = ({ conversation: c }) => {
  const update = useUpdateConversation();
  const defaults = useMemo<GroupIdentityFormValues>(() => ({ name: c.name, color: c.color, avatar_seed: c.avatar_seed ?? randomAvatarSeed() }), [c.name, c.color, c.avatar_seed]);
  const form = useForm<GroupIdentityFormValues>({ resolver: zodResolver(groupIdentitySchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [defaults, form]);
  const color = form.watch("color");
  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => update.mutate({ id: c.id, name: v.name.trim(), color: v.color, avatar_seed: v.avatar_seed }))}>
        <div className="flex items-center gap-4">
          <FormField control={form.control} name="avatar_seed" render={({ field }) => <AvatarPicker value={field.value} color={color} onChange={field.onChange} />} />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input maxLength={80} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField control={form.control} name="color" render={({ field }) => <FormItem><FormLabel>Colour</FormLabel><ColorSwatches value={field.value} onChange={field.onChange} /></FormItem>} />
        <Button type="submit" variant="outline" className="w-full" disabled={!form.formState.isDirty} loading={update.isPending}>
          Save
        </Button>
      </form>
    </Form>
  );
};

/** Side panel: group identity, people and bots (add/remove), lead bot (§7.1, §7.2). */
export const ConversationInfoPanel: FC<{ conversation: Conversation; meId: string; onClose?: () => void; menu?: ReactNode }> = ({ conversation: c, meId, onClose, menu }) => {
  const update = useUpdateConversation();
  const add = useAddParticipants();
  const remove = useRemoveParticipant();
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [removing, setRemoving] = useState<{ pid: string; label: string; self: boolean } | null>(null);
  const { data: bots } = useBots();
  const { data: members } = useMembers();
  const [pickBots, setPickBots] = useState<string[]>([]);
  const [pickUsers, setPickUsers] = useState<string[]>([]);
  const [viewBotId, setViewBotId] = useState<string | null>(null);
  const isDirect = c.type === ConversationTypes.DIRECT;
  const availableBots = (bots ?? []).filter((b) => !c.bots.some((x) => x.id === b.id));
  const closeAdd = () => {
    setAdding(null);
    setPickBots([]);
    setPickUsers([]);
  };

  // A bot opened from the group shows the same panel as in a direct chat.
  if (viewBotId && c.bots.some((b) => b.id === viewBotId)) {
    return <BotPanel botId={viewBotId} working={!!c.working_bot_ids?.includes(viewBotId)} onBack={() => setViewBotId(null)} onClose={onClose} menu={menu} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>
          Details
        </h2>
        <div className="flex items-center gap-2">
          {menu}
          {onClose && (
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={onClose} aria-label="Close panel">
              <X />
            </Button>
          )}
        </div>
      </div>
      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-5">
        <div>
          <p className="eyebrow mb-2">{getDropdownOptionLabel(ConversationTypeOptions, c.type)}</p>
          {isDirect ? (
            <p className="text-sm text-muted-foreground">A private chat between you and {c.bots[0]?.name}. Create a group to add people or more bots.</p>
          ) : (
            <GroupIdentityForm conversation={c} />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Bots</p>
            {c.type === ConversationTypes.GROUP && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(AddModes.BOTS)}>
                <Plus /> Add bots
              </Button>
            )}
          </div>
          <ul className="space-y-1">
            {c.bots.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-md p-1.5">
                <button type="button" onClick={() => setViewBotId(b.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-surface-sunken" aria-label={`View ${b.name}`}>
                  <BotAvatar seed={b.avatar_seed} color={b.color} size={32} name={b.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink">{b.name}</span>
                    {c.lead_bot?.id === b.id && c.type === ConversationTypes.GROUP && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Crown className="h-3 w-3" /> Lead bot
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                {c.type === ConversationTypes.GROUP && c.lead_bot?.id !== b.id && (
                  <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: c.id, lead_bot_id: b.id })}>
                    Make lead
                  </Button>
                )}
                {c.type === ConversationTypes.GROUP && c.bots.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${b.name}`} onClick={() => setRemoving({ pid: b.participant_id, label: b.name, self: false })}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">People</p>
            {!isDirect && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(AddModes.PEOPLE)}>
                <Plus /> Add people
              </Button>
            )}
          </div>
          <ul className="space-y-1">
            {c.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-md p-1.5">
                <PersonAvatar name={u.name} email={u.email} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">
                    {u.name ?? u.email} {u.id === meId && <span className="text-xs font-semibold text-muted-foreground">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
                {!isDirect && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={u.id === meId ? "Leave" : `Remove ${u.name ?? u.email}`} onClick={() => setRemoving({ pid: u.participant_id, label: u.name ?? u.email, self: u.id === meId })}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>

      <Dialog open={!!adding} onOpenChange={(o) => !add.isPending && !o && closeAdd()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{adding === AddModes.BOTS ? `Add bots to ${c.name}` : `Add people to ${c.name}`}</DialogTitle>
            <DialogDescription>{adding === AddModes.BOTS ? "Pick as many as you like. Talk to one with @name; the lead bot answers otherwise." : "Only members of this organisation can be added."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {adding === AddModes.BOTS && (
              <div>
                {availableBots.map((b) => (
                  <label key={b.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-sunken">
                    <Checkbox checked={pickBots.includes(b.id)} onCheckedChange={(v) => setPickBots((s) => (v ? [...s, b.id] : s.filter((x) => x !== b.id)))} />
                    <BotAvatar seed={b.avatar_seed} color={b.color} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{b.name}</span>
                      {b.description && <span className="block truncate text-xs text-muted-foreground">{b.description}</span>}
                    </span>
                  </label>
                ))}
                {availableBots.length === 0 && <p className="px-2 text-sm text-muted-foreground">Every bot you can use is already in this group.</p>}
              </div>
            )}
            {adding === AddModes.PEOPLE && (
            <div>
              <p className="eyebrow mb-1.5">People</p>
              {(members ?? [])
                .filter((m) => !c.users.some((u) => u.id === m.user.id))
                .map((m) => (
                  <label key={m.user.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-sunken">
                    <Checkbox checked={pickUsers.includes(m.user.id)} onCheckedChange={(v) => setPickUsers((s) => (v ? [...s, m.user.id] : s.filter((x) => x !== m.user.id)))} />
                    <PersonAvatar name={m.user.name} email={m.user.email} size={24} /> {m.user.name ?? m.user.email}
                  </label>
                ))}
              {(members ?? []).filter((m) => !c.users.some((u) => u.id === m.user.id)).length === 0 && <p className="px-2 text-sm text-muted-foreground">Everyone in the organisation is already here.</p>}
            </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAdd} disabled={add.isPending}>
              Cancel
            </Button>
            <Button
              loading={add.isPending}
              disabled={!pickBots.length && !pickUsers.length}
              onClick={() =>
                add.mutate(
                  { id: c.id, bot_ids: pickBots, user_ids: pickUsers },
                  { onSuccess: closeAdd },
                )
              }
            >
              {adding === AddModes.BOTS && pickBots.length > 1 ? `Add ${pickBots.length} bots` : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={removing?.self ? "Leave this conversation?" : `Remove ${removing?.label}?`}
        description={removing?.self ? "You'll lose access to its messages and files." : "They'll lose access to this conversation and its files."}
        confirmText={removing?.self ? "Leave" : "Remove"}
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate({ id: c.id, pid: removing.pid }, { onSuccess: () => setRemoving(null) })}
      />
    </div>
  );
};
