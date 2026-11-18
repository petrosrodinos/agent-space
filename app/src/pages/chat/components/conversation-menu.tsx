import type { FC } from "react";
import { Link } from "react-router-dom";
import { Archive, MoreHorizontal, Pin, Settings2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/features/conversations/interfaces/conversations.interfaces";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { Routes } from "@/routes/routes";

export interface ConversationMenuProps {
  conversation: Conversation;
  onPinned: () => void;
  onFavourite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/** The conversation's "more" menu: a round ⋯ button at the top of the side panel, next to its close button. */
export const ConversationMenu: FC<ConversationMenuProps> = ({ conversation: c, onPinned, onFavourite, onArchive, onDelete }) => {
  const lead = c.bots[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full transition-transform duration-200 active:scale-90" aria-label="Conversation menu">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-md p-1.5 shadow-pop">
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
