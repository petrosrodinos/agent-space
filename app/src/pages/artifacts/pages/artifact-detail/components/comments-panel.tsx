import { useState, type FC } from "react";
import { Check, CornerDownRight, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddComment, useArtifactComments, useDeleteComment, useResolveComment } from "@/features/artifacts/hooks/use-artifacts";
import { useConversation } from "@/features/conversations/hooks/use-conversations";
import type { Artifact, ArtifactCommentItem } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ArtifactRoles } from "@/features/artifacts/interfaces/artifacts.interfaces";

const NO_BOT = "none";

const CommentBody: FC<{ c: ArtifactCommentItem; artifactId: string; canModerate: boolean; onReply?: () => void; resolvable?: boolean }> = ({ c, artifactId, canModerate, onReply, resolvable }) => {
  const resolve = useResolveComment();
  const del = useDeleteComment();
  return (
    <div className="flex gap-2.5">
      <PersonAvatar name={c.author?.name} email={c.author?.email} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-bold text-ink">{c.author?.name ?? c.author?.email ?? "Former member"}</span> <span className="text-muted-foreground">· {timeAgo(c.created_at)}</span>
        </p>
        {c.mentioned_bot && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-0.5 pr-2 text-xs font-semibold text-accent-foreground">
            <BotAvatar seed={c.mentioned_bot.avatar_seed} color={c.mentioned_bot.color} size={24} /> @{c.mentioned_bot.name}
          </span>
        )}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-body">{c.content}</p>
        <div className="mt-1 flex flex-wrap gap-0.5">
          {onReply && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReply}>
              <CornerDownRight /> Reply
            </Button>
          )}
          {resolvable && (c.is_mine || canModerate) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => resolve.mutate({ id: artifactId, commentId: c.id, resolved: !c.resolved_at })}>
              {c.resolved_at ? <RotateCcw /> : <Check />} {c.resolved_at ? "Reopen" : "Resolve"}
            </Button>
          )}
          {c.is_mine && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => del.mutate({ id: artifactId, commentId: c.id })} aria-label="Delete comment">
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Threaded comments (§7.5 Comments and activity). Editors can @mention a bot from the artifact's conversation to make it edit. */
export const CommentsPanel: FC<{ artifact: Artifact }> = ({ artifact: a }) => {
  const { data, isPending } = useArtifactComments(a.id);
  const add = useAddComment();
  const isEditor = a.role === ArtifactRoles.OWNER || a.role === ArtifactRoles.EDITOR;
  const { data: conversation } = useConversation(isEditor && a.conversation ? a.conversation.id : undefined);
  const [text, setText] = useState("");
  const [bot, setBot] = useState<string>(NO_BOT);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const threads = (data ?? []).filter((t) => showResolved || !t.resolved_at);
  const resolvedCount = (data ?? []).filter((t) => t.resolved_at).length;

  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-lg border border-hairline p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          add.mutate({ id: a.id, content: text.trim(), mentioned_bot_id: bot === NO_BOT ? undefined : bot }, { onSuccess: () => (setText(""), setBot(NO_BOT)) });
        }}
      >
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={bot === NO_BOT ? "Leave a comment…" : "Tell the bot what to change…"} rows={3} maxLength={4000} aria-label="Comment" />
        <div className="flex items-center gap-2">
          {isEditor && !!conversation?.bots.length && (
            <Select value={bot} onValueChange={setBot}>
              <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="Ask a bot">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BOT}>Just a comment</SelectItem>
                {conversation.bots.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    Ask @{b.name} to change it
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="submit" size="sm" className="ml-auto" disabled={!text.trim()} loading={add.isPending}>
            <Send /> {bot === NO_BOT ? "Comment" : "Send"}
          </Button>
        </div>
      </form>

      {isPending ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : !threads.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{resolvedCount ? "All comments are resolved." : "No comments yet."}</p>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.id} className={cn("rounded-lg border border-hairline p-3", t.resolved_at && "opacity-70")}>
              <CommentBody c={t} artifactId={a.id} canModerate={isEditor} resolvable onReply={() => setReplyTo(replyTo === t.id ? null : t.id)} />
              {t.replies.length > 0 && (
                <ul className="mt-2 space-y-2 border-l-2 border-hairline pl-3">
                  {t.replies.map((r) => (
                    <li key={r.id}>
                      <CommentBody c={r} artifactId={a.id} canModerate={isEditor} />
                    </li>
                  ))}
                </ul>
              )}
              {replyTo === t.id && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!reply.trim()) return;
                    add.mutate({ id: a.id, content: reply.trim(), parent_comment_id: t.id }, { onSuccess: () => (setReply(""), setReplyTo(null)) });
                  }}
                >
                  <Textarea autoFocus value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply…" aria-label="Reply" className="min-h-[44px]" />
                  <Button type="submit" size="icon" aria-label="Send reply" disabled={!reply.trim()} loading={add.isPending}>
                    <Send />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {resolvedCount > 0 && (
        <button type="button" className="w-full text-center text-xs font-semibold text-primary hover:underline" onClick={() => setShowResolved((s) => !s)}>
          {showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}
        </button>
      )}
    </div>
  );
};
