import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircleButton } from "@/components/ui/circle-button";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { BotAvatar, BotAvatarStack, GroupAvatar } from "@/components/ui/bot-avatar";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { Routes } from "@/routes/routes";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation;
  working: string[];
  /** Whether the bot / details side panel is open (the centre pill toggles it). */
  panelOpen: boolean;
  onInfo: () => void;
  onSearch: () => void;
}

/** The floating centre pill (Grok-style): avatar + name; toggles the bot / details side panel. */
const TitlePill: FC<{ conversation: Conversation; working: string[]; panelOpen: boolean; onToggle: () => void }> = ({ conversation: c, working, panelOpen, onToggle }) => {
  const lead = c.bots[0];
  const isDirect = c.type === ConversationTypes.DIRECT && !!lead;
  const what = isDirect ? lead.name : "conversation details";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={panelOpen}
      aria-label={`${panelOpen ? "Hide" : "Show"} ${what}`}
      className={cn(
        "flex h-11 min-w-0 max-w-full animate-pop-in items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 shadow-sticker transition-[background-color,border-color,transform,box-shadow] duration-200 ease-[var(--ease-bounce)] hover:-translate-y-px hover:shadow-pop active:translate-y-0 active:scale-95",
        panelOpen ? "border-hairline-strong bg-hairline" : "border-hairline bg-surface-sunken hover:bg-hairline",
      )}
    >
      {c.type === ConversationTypes.GROUP ? (
        <GroupAvatar seed={c.avatar_seed} bots={c.bots} color={c.color} name={c.name} size={32} working={working.length > 0} className="rounded-full" />
      ) : lead ? (
        <BotAvatar seed={lead.avatar_seed} color={lead.color} name={lead.name} size={32} working={working.length > 0} className="rounded-full" />
      ) : (
        <BotAvatarStack bots={c.bots} size={24} max={2} />
      )}
      <span className="truncate text-[16px] font-bold text-ink">{c.name}</span>
      {c.is_temporary && <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Temporary</span>}
    </button>
  );
};

/** Mobile (Grok-style): floats over the messages — round back, the title pill, round search. The ⋯ menu lives in the side panel. */
const MobileConversationHeader: FC<Props> = ({ conversation: c, working, panelOpen, onInfo, onSearch }) => {
  const navigate = useNavigate();
  return (
    <MobileTopBar
      className="absolute inset-x-0 top-0 md:hidden"
      onBack={() => navigate(Routes.chat.root)}
      center={<TitlePill conversation={c} working={working} panelOpen={panelOpen} onToggle={onInfo} />}
      actions={
        <CircleButton onClick={onSearch} aria-label="Search in conversation">
          <Search />
        </CircleButton>
      }
    />
  );
};

/** Tablet and desktop (Grok-style): no bar — a floating centre pill that toggles the side panel, round search on the right. The ⋯ menu lives in the side panel. */
const DesktopConversationHeader: FC<Props> = ({ conversation: c, working, panelOpen, onInfo, onSearch }) => {
  const status = working.length
    ? `${c.bots
        .filter((b) => working.includes(b.id))
        .map((b) => b.name)
        .join(", ")} ${working.length > 1 ? "are" : "is"} working…`
    : "";
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden grid-cols-[1fr_auto_1fr] items-center gap-2 bg-gradient-to-b from-canvas via-canvas/80 to-transparent px-4 pb-4 pt-3 md:grid [&_button]:pointer-events-auto">
      <span />
      <div className="flex min-w-0 max-w-[420px] justify-center">
        <TitlePill conversation={c} working={working} panelOpen={panelOpen} onToggle={onInfo} />
        <span className="sr-only" aria-live="polite">
          {status}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        {c.type !== ConversationTypes.DIRECT && <BotAvatarStack bots={c.bots} size={24} max={4} />}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onSearch} aria-label="Search in conversation">
          <Search className="!h-5 !w-5" />
        </Button>
      </div>
    </header>
  );
};

export const ConversationHeader: FC<Props> = (props) => (
  <>
    <MobileConversationHeader {...props} />
    <DesktopConversationHeader {...props} />
  </>
);
