import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Lock, MessageCircle, MoreHorizontal, Plus, Search, Settings, Trash2, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBots, useDeleteBot, useDuplicateBot } from "@/features/bots/hooks/use-bots";
import { useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import type { Bot } from "@/features/bots/interfaces/bots.interfaces";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { BotVisibilityOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { Routes } from "@/routes/routes";
import { BotVisibilities } from "@/features/bots/interfaces/bots.interfaces";

const BotCard: FC<{ bot: Bot; onDelete: (b: Bot) => void }> = ({ bot, onDelete }) => {
  const navigate = useNavigate();
  const openDirect = useOpenDirect();
  const duplicate = useDuplicateBot();
  return (
    <div className="card-lift flex flex-col rounded-lg border border-hairline bg-surface p-4 shadow-sticker">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(Routes.bots.detail(bot.id))} aria-label={`${bot.name} settings`}>
          <BotAvatar seed={bot.avatar_seed} color={bot.color} name={bot.name} size={56} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate(Routes.bots.detail(bot.id))} className="block max-w-full truncate text-left text-[17px] font-bold text-ink hover:underline">
            {bot.name}
          </button>
          <p className="truncate text-xs text-muted-foreground">{bot.model?.name ?? "Recommended model"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {bot.visibility === BotVisibilities.ORGANIZATION && (
              <Badge variant="secondary">
                <Users className="h-3 w-3" /> {getDropdownOptionLabel(BotVisibilityOptions, bot.visibility)}
              </Badge>
            )}
            {bot.is_sensitive && <Badge variant="secondary"><Lock className="h-3 w-3" /> Sensitive</Badge>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`More actions for ${bot.name}`} className="h-11 w-11">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-md p-1.5">
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => navigate(Routes.bots.detail(bot.id))}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => duplicate.mutate(bot.id)}>
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            {bot.can_edit && !bot.is_starter && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-sm text-error focus:text-error" onSelect={() => onDelete(bot)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-body">{bot.description || "No description yet."}</p>
      <Button className="mt-4 w-full" variant="outline" loading={openDirect.isPending} onClick={() => openDirect.mutate({ bot_id: bot.id }, { onSuccess: (c) => navigate(Routes.chat.conversation(c.id)) })}>
        <MessageCircle /> Chat
      </Button>
    </div>
  );
};

const BotsPage: FC = () => {
  const [search, setSearch] = useState("");
  const { data: bots, isPending } = useBots(search || undefined);
  const del = useDeleteBot();
  const [deleting, setDeleting] = useState<Bot | null>(null);
  const navigate = useNavigate();

  return (
    <PageContainer wide>
      <PageHeader
        title="Bots"
        description="Your AI co-workers. Each has its own personality, model, tools and memory."
        actions={
          <Button onClick={() => navigate(Routes.bots.new)}>
            <Plus /> Create bot
          </Button>
        }
      />
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search bots" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search bots" />
      </div>
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[210px] rounded-lg" />
          ))}
        </div>
      ) : !bots?.length ? (
        search ? (
          <p className="py-12 text-center text-muted-foreground">No bots match "{search}".</p>
        ) : (
          <EmptyState
            title="Your team is a little quiet"
            description="Create your first bot from a template, by describing it, or from scratch."
            action={
              <Button size="lg" onClick={() => navigate(Routes.bots.new)}>
                <Plus /> Create a bot
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {bots.map((b) => (
            <BotCard key={b.id} bot={b} onDelete={setDeleting} />
          ))}
        </div>
      )}
      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "bot"}?`}
        description="The bot will be removed from your chats. Its past messages stay in conversations."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </PageContainer>
  );
};

export default BotsPage;
