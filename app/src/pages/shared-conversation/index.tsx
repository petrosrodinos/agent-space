import type { FC } from "react";
import { Link, useParams } from "react-router-dom";
import { Bot, FileText, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar, ConversationAvatar } from "@/components/ui/bot-avatar";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { FALLBACK_BOT_COLOR } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useSharedConversation } from "@/features/conversations/hooks/use-shared-conversation";
import { MessageAuthorTypes, MessageStatuses, type SharedMessage } from "@/features/conversations/interfaces/conversations.interfaces";
import { formatDateTime } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

type Visible = Extract<SharedMessage, { deleted: false }>;


const Bubble: FC<{ m: Visible }> = ({ m }) => {
  const mine = m.author_type === MessageAuthorTypes.USER;
  const working = m.status === MessageStatuses.PENDING || m.status === MessageStatuses.STREAMING;
  return (
    <div className={cn("flex gap-3", mine && "justify-end")}>
      {!mine && (
        <div className="mt-1 shrink-0">
          {m.author_avatar_seed ? <BotAvatar seed={m.author_avatar_seed} color={m.author_color ?? FALLBACK_BOT_COLOR} name={m.author_name} size={32} /> : <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-surface-sunken text-muted-foreground"><Bot className="h-4 w-4" /></span>}
        </div>
      )}
      <div className={cn("min-w-0 max-w-[85%]", mine && "text-right")}>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          {m.author_name} · {formatDateTime(m.created_at)}
        </p>
        <div className={cn("text-left", mine ? "inline-block rounded-lg bg-surface-sunken px-4 py-2.5" : "")}>
          {m.content ? <Markdown className="text-[15px] text-ink">{m.content}</Markdown> : working ? <span className="text-sm text-muted-foreground">Thinking…</span> : null}
          {m.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-ink">
                  <FileText className="h-3.5 w-3.5" /> {f.filename}
                </span>
              ))}
            </div>
          )}
          {m.sources.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {m.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-muted-foreground underline underline-offset-2 hover:text-ink">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const Unavailable: FC = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground"><Link2Off className="h-7 w-7" /></span>
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">This link isn't available</h1>
      <p className="mt-1 text-muted-foreground">The conversation was unshared or deleted. Ask the person who sent it for a new link.</p>
    </div>
    <Button asChild>
      <Link to={Routes.home}>Go to Agent Space</Link>
    </Button>
  </div>
);

/** Public, read-only conversation behind a share link. No account needed; live links keep updating. */
const SharedConversationPage: FC = () => {
  const { token = "" } = useParams();
  const { page, isPending, error, messages, hasMore, loadingMore, loadEarlier, ended, live } = useSharedConversation(token);

  if (isPending)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  if (error || !page) return <Unavailable />;

  const c = page.conversation;
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          {c.bots.length ? <ConversationAvatar conversation={{ type: c.bots.length > 1 ? ConversationTypes.GROUP : ConversationTypes.DIRECT, name: c.name, color: c.color, bots: c.bots.map((b, i) => ({ ...b, id: String(i) })) }} size={40} /> : <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken text-muted-foreground"><Bot className="h-5 w-5" /></span>}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold text-ink">{c.name}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {live && !ended && <span className="h-2 w-2 animate-pulse rounded-full bg-ink" aria-hidden />}
              {ended
                ? "Sharing stopped"
                : live
                  ? "Live · new messages appear automatically"
                  : `Shared${page.shared_by ? ` by ${page.shared_by}` : ""} · up to ${formatDateTime(page.cutoff_at)}`}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={Routes.home}>Open Agent Space</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        {hasMore && (
          <div className="text-center">
            <Button variant="ghost" size="sm" loading={loadingMore} onClick={() => void loadEarlier()}>
              Load earlier messages
            </Button>
          </div>
        )}
        {messages.length === 0 ? <p className="py-16 text-center text-muted-foreground">No messages in this conversation yet.</p> : messages.map((m) => <Bubble key={m.id} m={m} />)}
        {ended && <p className="rounded-md bg-surface-sunken px-4 py-3 text-center text-sm text-muted-foreground">The owner stopped sharing this conversation. What you see here is no longer updating.</p>}
      </main>
    </div>
  );
};

export default SharedConversationPage;
