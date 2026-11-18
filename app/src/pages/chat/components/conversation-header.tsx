import type { FC, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Info, MoreHorizontal, MoreVertical, Pin, Search, Settings2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircleButton } from "@/components/ui/circle-button";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
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

type MenuProps = Pick<Props, "conversation" | "onInfo" | "onSearch" | "onPinned" | "onFavourite" | "onArchive" | "onDelete"> & { children: ReactNode };

/** The conversation's "more" menu; `children` is the trigger. */
const ConversationMenu: FC<MenuProps> = ({ conversation: c, onInfo, onSearch, onPinned, onFavourite, onArchive, onDelete, children }) => {
  const lead = c.bots[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-md p-1.5 shadow-pop">
        <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onInfo}>
          <Info className="h-4 w-4" /> Details & people
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-sm md:hidden" onSelect={onSearch}>
          <Search className="h-4 w-4" /> Search in conversation
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onPinned}>
          <Pin className="h-4 w-4" /> Pinned messages
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onFavourite}>
          <Star className="h-4 w-4" /> {c.me?.is_favourite ? "Remove from favourites" : "Add to favourites"}
        </DropdownMenuItem>
        {lead && c.type === ConversationTypes.DIRECT && (
          <DropdownMenuItem asChild className="gap-2 rounded-sm">
            <Link to={Routes.bots.detail(lead.id)}>
              <Settings2 className="h-4 w-4" /> Bot settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onArchive}>
          <Archive className="h-4 w-4" /> {c.me?.is_archived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-sm text-error focus:text-error" onSelect={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete conversation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Mobile (Grok-style): floats over the messages — round back, a pill with the avatar and name, round "more". */
const MobileConversationHeader: FC<Props> = (props) => {
  const { conversation: c, working, onInfo } = props;
  const navigate = useNavigate();
  const lead = c.bots[0];
  const isDirect = c.type === ConversationTypes.DIRECT && !!lead;
  return (
    <MobileTopBar
      className="absolute inset-x-0 top-0 md:hidden"
      onBack={() => navigate(Routes.chat.root)}
      center={
        <button
          type="button"
          onClick={() => (isDirect ? navigate(Routes.bots.detail(lead.id)) : onInfo())}
          className="flex h-11 min-w-0 max-w-full items-center gap-2 rounded-full border border-hairline bg-surface-sunken py-1 pl-1.5 pr-4 shadow-sticker transition-colors hover:bg-hairline"
          aria-label={isDirect ? `${lead.name} settings` : "Conversation details"}
        >
          {c.type === ConversationTypes.GROUP ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: c.color }}>
              {c.emoji}
            </span>
          ) : lead ? (
            <BotAvatar emoji={lead.emoji} color={lead.color} name={lead.name} size={32} working={working.length > 0} className="rounded-full" />
          ) : (
            <BotAvatarStack bots={c.bots} size={24} max={2} />
          )}
          <span className="truncate text-[16px] font-bold text-ink">{c.name}</span>
        </button>
      }
      actions={
        <>
          <ComputerButton conversation={c} className="h-11 w-11 rounded-full border border-hairline bg-surface-sunken shadow-sticker" />
          <ConversationMenu {...props}>
            <CircleButton aria-label="Conversation menu">
              <MoreHorizontal />
            </CircleButton>
          </ConversationMenu>
        </>
      }
    />
  );
};

/** Tablet and desktop: full-width header with subtitle and inline actions. */
const DesktopConversationHeader: FC<Props> = ({ conversation: c, working, onInfo, onSearch, onPinned, onFavourite, onArchive, onDelete }) => {
  const lead = c.bots[0];
  const menuProps = { conversation: c, onInfo, onSearch, onPinned, onFavourite, onArchive, onDelete };
  const subtitle =
    working.length > 0
      ? `${c.bots
          .filter((b) => working.includes(b.id))
          .map((b) => b.name)
          .join(", ")} ${working.length > 1 ? "are" : "is"} working…`
      : c.type === ConversationTypes.DIRECT
        ? (lead?.description ?? "Bot")
        : `${c.bots.length} ${c.bots.length === 1 ? "bot" : "bots"} · ${c.users.length} ${c.users.length === 1 ? "person" : "people"}`;
  return (
    <header className="hidden min-h-[64px] items-center gap-2 border-b border-hairline bg-canvas/90 px-4 backdrop-blur md:flex">
      <button type="button" onClick={onInfo} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left hover:bg-surface-sunken/60" aria-label="Conversation details">
        {c.type === ConversationTypes.GROUP ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-2xl" style={{ backgroundColor: c.color }}>
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
      <ConversationMenu {...menuProps}>
        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Conversation menu">
          <MoreVertical className="!h-5 !w-5" />
        </Button>
      </ConversationMenu>
    </header>
  );
};

export const ConversationHeader: FC<Props> = (props) => (
  <>
    <MobileConversationHeader {...props} />
    <DesktopConversationHeader {...props} />
  </>
);
