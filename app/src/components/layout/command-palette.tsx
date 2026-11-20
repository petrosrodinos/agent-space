import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, AppWindow, Bot, CheckCheck, KeyRound, LayoutDashboard, ListChecks, MessageSquare, Plug, Settings, Sparkles } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { useConversations, useGlobalSearch, useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useUiStore } from "@/stores/ui";
import { Routes } from "@/routes/routes";
import { shortStamp } from "@/lib/date";

/** Ctrl/Cmd+K: jump to conversations, bots and pages, and search all messages (§7.2 global search). */
export const CommandPalette: FC = () => {
  const open = useUiStore((s) => s.command_open);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: conversations } = useConversations();
  const { data: bots } = useBots();
  const { data: hits } = useGlobalSearch(q);
  const openDirect = useOpenDirect();
  const go = (path: string) => {
    setOpen(false);
    setQ("");
    navigate(path);
  };
  const pages = [
    { label: "Tasks", path: Routes.tasks.root, icon: <ListChecks /> },
    { label: "Automations", path: Routes.automations.root, icon: <AlarmClock /> },
    { label: "Approvals", path: Routes.approvals.root, icon: <CheckCheck /> },
    { label: "Bots", path: Routes.bots.root, icon: <Bot /> },
    { label: "Artifacts", path: Routes.artifacts.root, icon: <AppWindow /> },
  { label: "Widgets", path: Routes.widgets.root, icon: <LayoutDashboard /> },
    { label: "Skills", path: Routes.skills.root, icon: <Sparkles /> },
    { label: "Connections", path: Routes.connections.root, icon: <Plug /> },
    { label: "Secrets", path: Routes.secrets, icon: <KeyRound /> },
    { label: "Settings", path: Routes.settings.profile, icon: <Settings /> },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search conversations, bots, messages…" value={q} onValueChange={setQ} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing found.</CommandEmpty>
        {!!conversations?.length && (
          <CommandGroup heading="Conversations">
            {conversations.slice(0, 8).map((c) => (
              <CommandItem key={c.id} value={`conv ${c.name}`} onSelect={() => go(Routes.chat.conversation(c.id))} className="gap-2">
                <span className="text-lg">{c.emoji}</span> {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!bots?.length && (
          <CommandGroup heading="Chat with a bot">
            {bots.map((b) => (
              <CommandItem
                key={b.id}
                value={`bot ${b.name} ${b.description ?? ""}`}
                onSelect={() =>
                  openDirect.mutate({ bot_id: b.id }, { onSuccess: (c) => go(Routes.chat.conversation(c.id)) })
                }
                className="gap-2"
              >
                <BotAvatar emoji={b.emoji} color={b.color} size={24} /> {b.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!hits?.length && (
          <CommandGroup heading="Messages">
            {hits.map((h) => (
              <CommandItem key={h.id} value={`msg ${h.snippet} ${h.id}`} onSelect={() => go(Routes.chat.conversation(h.conversation.id))} className="items-start gap-2">
                <MessageSquare className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {h.conversation.name ?? "Conversation"} · {h.author?.name} · {shortStamp(h.created_at)}
                  </span>
                  <span className="line-clamp-2 text-sm">{h.snippet}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem key={p.path} value={`page ${p.label}`} onSelect={() => go(p.path)} className="gap-2">
              {p.icon} {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
