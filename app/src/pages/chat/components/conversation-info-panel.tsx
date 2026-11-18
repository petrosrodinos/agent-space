import { useState, type FC, type ReactNode } from "react";
import { Crown, Plus, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BotEmojiSuggestions } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";

/** Side panel: name/emoji, people and bots (add/remove), lead bot (§7.1, §7.2). */
export const ConversationInfoPanel: FC<{ conversation: Conversation; meId: string; onClose?: () => void; menu?: ReactNode }> = ({ conversation: c, meId, onClose, menu }) => {
  const update = useUpdateConversation();
  const add = useAddParticipants();
  const remove = useRemoveParticipant();
  const [name, setName] = useState(c.name);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ pid: string; label: string; self: boolean } | null>(null);
  const { data: bots } = useBots();
  const { data: members } = useMembers();
  const [pickBots, setPickBots] = useState<string[]>([]);
  const [pickUsers, setPickUsers] = useState<string[]>([]);
  const isDirect = c.type === ConversationTypes.DIRECT;

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
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && name !== c.name) update.mutate({ id: c.id, name: name.trim() });
              }}
            >
              <Label htmlFor="conv-name">Name</Label>
              <div className="flex gap-2">
                <Input id="conv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                <Button type="submit" variant="outline" disabled={!name.trim() || name === c.name} loading={update.isPending}>
                  Save
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 pt-1" aria-label="Emoji">
                {BotEmojiSuggestions.slice(0, 12).map((e) => (
                  <button key={e} type="button" onClick={() => update.mutate({ id: c.id, emoji: e })} className={`inline-flex h-9 w-9 items-center justify-center rounded-sm text-lg ${c.emoji === e ? "bg-primary-soft ring-2 ring-primary" : "hover:bg-surface-sunken"}`} aria-label={`Emoji ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            </form>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Bots</p>
          </div>
          <ul className="space-y-1">
            {c.bots.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-md p-1.5">
                <BotAvatar emoji={b.emoji} color={b.color} size={32} name={b.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{b.name}</span>
                  {c.lead_bot?.id === b.id && c.type === ConversationTypes.GROUP && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Crown className="h-3 w-3" /> Lead bot
                    </span>
                  )}
                </span>
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
          <p className="eyebrow mb-2">People</p>
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

        {!isDirect && (
          <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
            <Plus /> Add people or bots
          </Button>
        )}
      </div>

      <Dialog open={adding} onOpenChange={(o) => !add.isPending && setAdding(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to {c.name}</DialogTitle>
            <DialogDescription>Only members of this organisation can be added.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {c.type === ConversationTypes.GROUP && (
              <div>
                <p className="eyebrow mb-1.5">Bots</p>
                {(bots ?? [])
                  .filter((b) => !c.bots.some((x) => x.id === b.id))
                  .map((b) => (
                    <label key={b.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-sunken">
                      <Checkbox checked={pickBots.includes(b.id)} onCheckedChange={(v) => setPickBots((s) => (v ? [...s, b.id] : s.filter((x) => x !== b.id)))} />
                      <BotAvatar emoji={b.emoji} color={b.color} size={24} /> {b.name}
                    </label>
                  ))}
              </div>
            )}
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
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdding(false)} disabled={add.isPending}>
              Cancel
            </Button>
            <Button
              loading={add.isPending}
              disabled={!pickBots.length && !pickUsers.length}
              onClick={() =>
                add.mutate(
                  { id: c.id, bot_ids: pickBots, user_ids: pickUsers },
                  {
                    onSuccess: () => {
                      setAdding(false);
                      setPickBots([]);
                      setPickUsers([]);
                    },
                  },
                )
              }
            >
              Add
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
