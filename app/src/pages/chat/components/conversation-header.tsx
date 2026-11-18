import type { FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArrowLeft, Info, MoreVertical, Pin, Search, Settings2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar, BotAvatarStack } from "@/components/ui/bot-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { Routes } from "@/routes/routes";
import { ComputerButton } from "./computer-button";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";

interface Props {
  conversation: Conversation;
  working: string[];
  onInfo: () => void;
  onSearch: () => void;
  onPinned: () => void;
  onFavourite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const ConversationHeader: FC<Props> = ({ conversation: c, working, onInfo, onSearch, onPinned, onFavourite, onArchive, onDelete }) => {
  const navigate = useNavigate();
  const lead = c.bots[0];
  const subtitle =
    working.length > 0
      ? `${c.bots.filter((b) => working.includes(b.id)).map((b) => b.name).join(", ")} ${working.length > 1 ? "are" : "is"} working…`
      : c.type === ConversationTypes.DIRECT
        ? (lead?.description ?? "Bot")
        : `${c.bots.length} ${c.bots.length === 1 ? "bot" : "bots"} · ${c.users.length} ${c.users.length === 1 ? "person" : "people"}`;
  return (
    <header className="safe-top flex min-h-[64px] items-center gap-2 border-b border-hairline bg-canvas/90 px-2 backdrop-blur sm:px-4">
      <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" onClick={() => navigate(Routes.chat.root)} aria-label="Back to chats">
        <ArrowLeft className="!h-5 !w-5" />
      </Button>
      <button type="button" onClick={onInfo} className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] p-1 text-left hover:bg-surface-sunken/60" aria-label="Conversation details">
        {c.type === ConversationTypes.GROUP ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-2xl" style={{ backgroundColor: c.color }}>
            {c.emoji}
          </span>
        ) : lead ? (
          <BotAvatar emoji={lead.emoji} color={lead.color} name={lead.name} working={working.length > 0} />
        ) : (
          <BotAvatarStack bots={c.bots} />
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[17px] font-bold text-ink">{c.name}</span>
            {c.is_temporary && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Temporary</span>}
          </span>
          <span className={working.length ? "block truncate text-[13px] font-semibold text-accent-foreground" : "block truncate text-[13px] text-muted-foreground"} aria-live="polite">
            {subtitle}
          </span>
        </span>
      </button>
      {c.type !== ConversationTypes.DIRECT && <BotAvatarStack bots={c.bots} size={24} max={4} />}
      <ComputerButton conversation={c} />
      <Button variant="ghost" size="icon" className="hidden h-10 w-10 sm:inline-flex" onClick={onSearch} aria-label="Search in conversation">
        <Search className="!h-5 !w-5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Conversation menu">
            <MoreVertical className="!h-5 !w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-[14px] p-1.5 shadow-pop">
          <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onInfo}>
            <Info className="h-4 w-4" /> Details & people
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-[10px] sm:hidden" onSelect={onSearch}>
            <Search className="h-4 w-4" /> Search in conversation
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onPinned}>
            <Pin className="h-4 w-4" /> Pinned messages
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onFavourite}>
            <Star className="h-4 w-4" /> {c.me?.is_favourite ? "Remove from favourites" : "Add to favourites"}
          </DropdownMenuItem>
          {lead && c.type === ConversationTypes.DIRECT && (
            <DropdownMenuItem asChild className="gap-2 rounded-[10px]">
              <Link to={Routes.bots.detail(lead.id)}>
                <Settings2 className="h-4 w-4" /> Bot settings
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onArchive}>
            <Archive className="h-4 w-4" /> {c.me?.is_archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-[10px] text-error focus:text-error" onSelect={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};
