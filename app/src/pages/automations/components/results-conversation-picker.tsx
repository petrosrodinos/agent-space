import { useMemo, type FC } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConversations } from "@/features/conversations/hooks/use-conversations";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { useUpdateAutomation } from "@/features/automations/hooks/use-automations";
import type { Automation } from "@/features/automations/interfaces/automations.interfaces";
import { Routes } from "@/routes/routes";

interface ConversationOption {
  id: string;
  label: string;
  type: string;
}

/** Choose which chat (direct chat or a group the bot is in) the automation posts its results to. */
export const ResultsConversationPicker: FC<{ automation: Automation }> = ({ automation: a }) => {
  const { data: conversations } = useConversations();
  const update = useUpdateAutomation();

  const options = useMemo(() => {
    const list: ConversationOption[] = (conversations ?? [])
      .filter((c) => !c.is_temporary && c.bots.some((b) => b.id === a.bot.id))
      .map((c) => ({ id: c.id, label: c.name, type: c.type }));
    // The current destination may be archived and so missing from the list; keep it selectable.
    const current = a.results_conversation;
    if (current && !list.some((o) => o.id === current.id)) list.unshift({ id: current.id, label: current.name ?? `Chat with ${a.bot.name}`, type: current.type });
    return list;
  }, [conversations, a.bot.id, a.bot.name, a.results_conversation]);

  const value = a.results_conversation_id ?? undefined;

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={(id) => id !== value && update.mutate({ id: a.id, results_conversation_id: id })} disabled={update.isPending}>
        <SelectTrigger aria-label="Conversation the results are posted in"><SelectValue placeholder="Choose a conversation" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="flex items-center gap-2">
                {o.type === ConversationTypes.GROUP ? <Users className="h-4 w-4 text-muted-foreground" /> : <MessageCircle className="h-4 w-4 text-muted-foreground" />}
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && <Link to={Routes.chat.conversation(value)} className="text-xs font-semibold text-muted-foreground hover:text-ink hover:underline">Open conversation</Link>}
    </div>
  );
};
