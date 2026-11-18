import { memo, useRef, useState, type FC, type ReactNode, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, AlertCircle, BookOpen, ClipboardCheck, Copy, GitBranch, Mic, MoreHorizontal, Pencil, Pin, RefreshCw, Reply, SmilePlus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { botSoftColor } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { MessageAuthorTypes, MessagePartTypes, MessageSources, MessageStatuses, type Message, type MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";
import type { ActivityStepsDisplay } from "@/features/users/interfaces/users.interfaces";
import type { AiModel } from "@/features/bots/interfaces/bots.interfaces";
import { formatDateTime, formatTime } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActivitySteps } from "./activity-steps";
import { ApprovalCard } from "./approval-card";
import { InteractiveReply } from "./interactive-reply";
import { SecretInputCard } from "./secret-input-card";
import { FileChip, FileChipTones } from "./file-chip";
import { ArtifactCard } from "./artifact-card";
import { ReplyQuote, ReplyQuoteVariants } from "./reply-quote";
import { useSwipeToReply } from "../hooks/use-swipe-to-reply";
import { ComputerHandoffCard } from "./computer-handoff-card";
import { QUICK_REACTIONS } from "@/config/constants/reactions";

export interface MessageActions {
  onRetry: (m: Message, modelId?: string) => void;
  onBranch: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onPin: (m: Message) => void;
  onEdit: (m: Message, content: string) => void;
  onDelete: (m: Message) => void;
  onFollowUp: (text: string) => void;
  onReply: (m: Message) => void;
  onJumpToMessage: (id: string) => void;
}

interface Props {
  message: Message;
  meId: string;
  isFirstOfGroup: boolean;
  working: boolean;
  activityMode: ActivityStepsDisplay;
  models: AiModel[];
  actions: MessageActions;
  canAnswerApprovals: boolean;
}

const TypingDots: FC<{ color: string }> = ({ color }) => (
  <span className="inline-flex items-center gap-1 px-1 py-2" aria-label="Thinking">
    {[0, 1, 2].map((i) => (
      <span key={i} className="h-2 w-2 animate-dot rounded-full" style={{ backgroundColor: color, animationDelay: `${i * 160}ms` }} />
    ))}
  </span>
);

const ReactionAligns = { START: "start", END: "end" } as const;
type ReactionAlign = (typeof ReactionAligns)[keyof typeof ReactionAligns];
const SegmentKinds = { STEPS: "steps", PART: "part" } as const;
type ToolPart = Extract<MessagePart, { type: typeof MessagePartTypes.TOOL }>;

/** Groups consecutive tool parts so the activity feed renders as one block. */
function segment(parts: MessagePart[]) {
  const out: ({ kind: typeof SegmentKinds.STEPS; steps: ToolPart[] } | { kind: typeof SegmentKinds.PART; part: MessagePart; index: number })[] = [];
  parts.forEach((p, index) => {
    if (p.type === MessagePartTypes.TOOL) {
      const last = out[out.length - 1];
      if (last?.kind === SegmentKinds.STEPS) last.steps.push(p);
      else out.push({ kind: SegmentKinds.STEPS, steps: [p] });
    } else out.push({ kind: SegmentKinds.PART, part: p, index });
  });
  return out;
}

const ActionsMenu: FC<{ m: Message; mine: boolean; models: AiModel[]; actions: MessageActions; onStartEdit: () => void }> = ({ m, mine, models, actions, onStartEdit }) => (
  <div className="absolute -top-4 right-2 z-10 hidden items-center gap-0.5 rounded-full border border-hairline bg-surface p-0.5 shadow-pop group-hover:flex group-focus-within:flex has-data-[state=open]:flex">
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Reply" onClick={() => actions.onReply(m)}>
      <Reply />
    </Button>
    {QUICK_REACTIONS.slice(0, 3).map((e) => (
      <button key={e} type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-surface-sunken" onClick={() => actions.onReact(m, e)} aria-label={`React ${e}`}>
        {e}
      </button>
    ))}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <MessageMenuContent m={m} mine={mine} models={models} actions={actions} onStartEdit={onStartEdit} />
    </DropdownMenu>
  </div>
);

const MessageMenuContent: FC<{ m: Message; mine: boolean; models: AiModel[]; actions: MessageActions; onStartEdit: () => void }> = ({ m, mine, models, actions, onStartEdit }) => (
  <DropdownMenuContent align={ReactionAligns.END} className="w-60 rounded-[14px] p-1.5 shadow-pop">
    <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => actions.onReply(m)}>
      <Reply className="h-4 w-4" /> Reply
    </DropdownMenuItem>
    <DropdownMenuItem
      className="gap-2 rounded-[10px]"
      onSelect={() => {
        void platform.clipboard.writeText(m.content ?? "");
        toast({ title: "Copied", duration: 1200 });
      }}
    >
      <Copy className="h-4 w-4" /> Copy
    </DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 rounded-[10px]">
        <SmilePlus className="h-4 w-4" /> React
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="flex gap-1 rounded-[14px] p-1.5">
        {QUICK_REACTIONS.map((e) => (
          <DropdownMenuItem key={e} className="justify-center rounded-full px-2 text-lg" onSelect={() => actions.onReact(m, e)}>
            {e}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => actions.onPin(m)}>
      <Pin className="h-4 w-4" /> {m.is_pinned ? "Unpin" : "Pin"}
    </DropdownMenuItem>
    {m.author_type === MessageAuthorTypes.BOT && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => actions.onRetry(m)}>
          <RefreshCw className="h-4 w-4" /> Try again
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => actions.onBranch(m)}>
          <GitBranch className="h-4 w-4" /> Try a different approach
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 rounded-[10px]">
            <RefreshCw className="h-4 w-4" /> Retry with another model
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto rounded-[14px] p-1.5">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Compare answers</DropdownMenuLabel>
            {models
              .filter((x) => x.allowed)
              .map((x) => (
                <DropdownMenuItem key={x.id} className="rounded-[10px]" onSelect={() => actions.onRetry(m, x.id)}>
                  {x.name} <span className="ml-auto text-xs text-muted-foreground">{x.provider}</span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    )}
    {mine && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onStartEdit}>
          <Pencil className="h-4 w-4" /> Edit and re-run
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-[10px] text-error focus:text-error" onSelect={() => actions.onDelete(m)}>
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
);

const Reactions: FC<{ m: Message; meId: string; onReact: (e: string) => void; align: ReactionAlign }> = ({ m, meId, onReact, align }) =>
  m.reactions.length ? (
    <div className={cn("mt-1 flex flex-wrap gap-1", align === ReactionAligns.END && "justify-end")}>
      {m.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={cn("inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2 text-sm transition-transform active:scale-110", r.user_ids.includes(meId) ? "border-primary bg-primary-soft" : "border-hairline bg-surface")}
          aria-label={`${r.emoji} ${r.count}`}
        >
          {r.emoji} <span className="text-xs font-bold text-body">{r.count}</span>
        </button>
      ))}
    </div>
  ) : null;

export const MessageItem: FC<Props> = memo(({ message: m, meId, isFirstOfGroup, working, activityMode, models, actions, canAnswerApprovals }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content ?? "");
  const pressTimer = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const mine = m.author_type === MessageAuthorTypes.USER && m.author_user?.id === meId;
  const swipe = useSwipeToReply({ enabled: !m.pending && !editing, onReply: () => actions.onReply(m) });
  const clearPress = () => pressTimer.current && window.clearTimeout(pressTimer.current);
  // Long-press opens the menu, a horizontal swipe replies; any movement cancels the long-press.
  const longPress = {
    ref: swipe.rowRef,
    onTouchStart: (e: TouchEvent) => {
      pressTimer.current = window.setTimeout(() => setMenuOpen(true), 450);
      swipe.handlers.onTouchStart(e);
    },
    onTouchMove: (e: TouchEvent) => {
      clearPress();
      swipe.handlers.onTouchMove(e);
    },
    onTouchEnd: () => {
      clearPress();
      swipe.handlers.onTouchEnd();
    },
    onTouchCancel: () => {
      clearPress();
      swipe.handlers.onTouchCancel();
    },
  };
  const swipeHint = (
    <span ref={swipe.hintRef} aria-hidden className="pointer-events-none absolute -left-10 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground opacity-0">
      <Reply className="h-4 w-4" />
    </span>
  );
  const quote = m.reply_to && (
    <div className="mb-1.5 w-full min-w-[160px]">
      <ReplyQuote reply={m.reply_to} meId={meId} variant={mine ? ReplyQuoteVariants.ON_PRIMARY : ReplyQuoteVariants.ON_SURFACE} onJump={actions.onJumpToMessage} />
    </div>
  );
  const mobileMenu = (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger className="sr-only">Message actions</DropdownMenuTrigger>
      <MessageMenuContent m={m} mine={mine} models={models} actions={actions} onStartEdit={() => setEditing(true)} />
    </DropdownMenu>
  );

  if (m.author_type === MessageAuthorTypes.SYSTEM) {
    return (
      <div className="my-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {m.content}
        </span>
      </div>
    );
  }

  const text = m.content ?? "";
  const timeLine = (
    <span className="text-[11px] font-semibold text-muted-foreground">
      {m.source === MessageSources.VOICE && <Mic className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-label="Spoken" />}
      {formatTime(m.created_at)}
      {m.edited_at && " · edited"}
      {m.is_pinned && (
        <>
          {" · "}
          <Pin className="inline h-3 w-3 align-[-2px]" aria-label="Pinned" />
        </>
      )}
    </span>
  );

  // ---- User messages ----
  if (m.author_type === MessageAuthorTypes.USER) {
    const interaction = m.parts.find((p) => p.type === MessagePartTypes.INTERACTION) as Extract<MessagePart, { type: typeof MessagePartTypes.INTERACTION }> | undefined;
    if (mine) {
      return (
        <div className={cn("group relative flex animate-slide-up touch-pan-y flex-col items-end", isFirstOfGroup ? "mt-4" : "mt-1")} {...longPress}>
          {swipeHint}
          {mobileMenu}
          {editing ? (
            <div className="w-full max-w-[min(560px,90%)] space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="min-h-[90px]" aria-label="Edit message" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    actions.onEdit(m, draft);
                    setEditing(false);
                  }}
                  disabled={!draft.trim()}
                >
                  Save and re-run
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn("relative max-w-[min(560px,88%)] rounded-[20px] rounded-br-[6px] bg-primary px-4 py-2.5 text-[15px] text-primary-foreground shadow-sticker", m.pending && "opacity-70")}>
              <ActionsMenu m={m} mine models={models} actions={actions} onStartEdit={() => setEditing(true)} />
              {quote}
              {m.source === MessageSources.VOICE && <Mic className="mr-1 inline h-3.5 w-3.5 opacity-80" aria-label="Spoken" />}
              {interaction ? (
                <span className="text-[14px]">
                  <ClipboardCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> Responded to <strong>{interaction.component_id}</strong>
                  <span className="mt-1 block whitespace-pre-wrap opacity-90">{text.split("\n").slice(1).join("\n")}</span>
                </span>
              ) : (
                <span className="whitespace-pre-wrap break-words">{text}</span>
              )}
              {m.files.length > 0 && (
                <div className="mt-2 flex flex-col items-end gap-1.5">
                  {m.files.map((f) => (
                    <FileChip key={f.id} file={f} tone={FileChipTones.ON_PRIMARY} />
                  ))}
                </div>
              )}
            </div>
          )}
          {m.secret_masked && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
              <AlertCircle className="h-3 w-3" /> A secret was masked and not shared with the bot
            </span>
          )}
          <Reactions m={m} meId={meId} onReact={(e) => actions.onReact(m, e)} align={ReactionAligns.END} />
          <div className="mt-0.5">{timeLine}</div>
        </div>
      );
    }
    return (
      <div className={cn("group relative flex animate-slide-up touch-pan-y gap-2.5", isFirstOfGroup ? "mt-4" : "mt-1")} {...longPress}>
        {swipeHint}
        {mobileMenu}
        <div className="w-8 shrink-0">{isFirstOfGroup && <PersonAvatar name={m.author_user?.name} email={m.author_user?.email} size={32} />}</div>
        <div className="min-w-0 max-w-[min(560px,85%)]">
          {isFirstOfGroup && (
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="text-[15px] font-bold text-ink">{m.author_user?.name ?? m.author_user?.email}</span>
              {timeLine}
            </div>
          )}
          <div className="relative rounded-[20px] rounded-bl-[6px] bg-surface-sunken px-4 py-2.5 text-[15px] text-ink">
            <ActionsMenu m={m} mine={false} models={models} actions={actions} onStartEdit={() => undefined} />
            {quote}
            <span className="whitespace-pre-wrap break-words">{text}</span>
            {m.files.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {m.files.map((f) => (
                  <FileChip key={f.id} file={f} />
                ))}
              </div>
            )}
          </div>
          <Reactions m={m} meId={meId} onReact={(e) => actions.onReact(m, e)} align={ReactionAligns.START} />
        </div>
      </div>
    );
  }

  // ---- Bot messages ----
  const bot = m.author_bot!;
  const streaming = m.status === MessageStatuses.STREAMING || m.status === MessageStatuses.PENDING;
  const hasText = m.parts.some((p) => p.type === MessagePartTypes.TEXT && p.text.trim());
  const long = text.length > 700 || m.parts.some((p) => p.type === MessagePartTypes.TEXT && /(^|\n)(\||#{1,3} |```)/.test(p.text));

  const renderPart = (p: MessagePart, i: number): ReactNode => {
    switch (p.type) {
      case MessagePartTypes.TEXT:
        return p.text.trim() ? (
          <div key={i} className={cn(long ? "py-1" : "rounded-[20px] rounded-tl-[6px] border border-hairline bg-surface px-4 py-3 shadow-sticker", "my-1 w-fit max-w-full")}>
            <Markdown>{p.text}</Markdown>
          </div>
        ) : null;
      case MessagePartTypes.UI:
        return <InteractiveReply key={i} messageId={m.id} part={p} />;
      case MessagePartTypes.APPROVAL:
        return <ApprovalCard key={p.approval_id} part={p} canAnswer={canAnswerApprovals} />;
      case MessagePartTypes.SECRET_INPUT:
        return <SecretInputCard key={p.request_id} part={p} />;
      case MessagePartTypes.COMPUTER_HANDOFF:
        return <ComputerHandoffCard key={p.request_id} part={p} runId={m.run_id} botName={bot.name} canAct={!m.run?.user_id || m.run.user_id === meId} />;
      case MessagePartTypes.SKILL:
        return (
          <span key={i} className="my-1 mr-1 inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-1.5 pr-2.5 text-xs font-semibold text-accent-foreground">
            {p.emoji ?? <BookOpen className="h-3.5 w-3.5" aria-hidden />} Using {p.name}
          </span>
        );
      case MessagePartTypes.CONSULTED:
        return (
          <span key={i} className="my-1 mr-1 inline-flex items-center gap-1.5 rounded-full bg-surface-sunken py-1 pl-1 pr-2.5 text-xs font-semibold text-muted-foreground">
            <BotAvatar emoji={p.bot.emoji} color={p.bot.color} size={24} /> Asked {p.bot.name}…
          </span>
        );
      case MessagePartTypes.ARTIFACT:
        return <ArtifactCard key={`${p.artifact_id}-${i}`} part={p} />;
      case MessagePartTypes.AUTOMATION:
        return (
          <Link key={i} to={Routes.automations.detail(p.automation_id)} className="card-lift my-1.5 flex max-w-sm items-center gap-3 rounded-[16px] border border-hairline bg-surface p-3 shadow-sticker">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-accent-foreground"><AlarmClock className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.schedule ?? "Automation saved"}{p.next_run_at ? ` · next ${formatDateTime(p.next_run_at)}` : ""}</span>
            </span>
          </Link>
        );
      case MessagePartTypes.FILE:
        return (
          <div key={i} className="my-1.5">
            <FileChip file={{ id: p.file_id, filename: p.filename, mimetype: p.mimetype, size: p.size }} />
          </div>
        );
      case MessagePartTypes.SOURCES:
        return (
          <div key={i} className="my-1.5 flex flex-wrap gap-1.5">
            {p.sources.map((s, j) => {
              let host = s.url;
              try {
                host = new URL(s.url).hostname.replace(/^www\./, "");
              } catch {
                /* keep */
              }
              return (
                <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-body hover:border-primary hover:text-primary">
                  {j + 1}. {s.title || host}
                </a>
              );
            })}
          </div>
        );
      case MessagePartTypes.NOTICE:
        return (
          <p key={i} className="my-1 text-xs font-semibold text-muted-foreground">
            {p.text}
          </p>
        );
      case MessagePartTypes.ERROR:
        return (
          <div key={i} className="my-1.5 flex flex-wrap items-center gap-2 rounded-[14px] bg-error-soft px-3 py-2 text-sm text-ink">
            <AlertCircle className="h-4 w-4 text-error" /> {p.message}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => actions.onRetry(m)}>
              <RefreshCw /> Try again
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const followUps = m.parts.find((p) => p.type === MessagePartTypes.FOLLOW_UPS) as Extract<MessagePart, { type: typeof MessagePartTypes.FOLLOW_UPS }> | undefined;
  return (
    <div className={cn("group relative flex animate-slide-up touch-pan-y gap-2.5", isFirstOfGroup ? "mt-5" : "mt-1")} {...longPress}>
      {swipeHint}
      {mobileMenu}
      <div className="w-10 shrink-0">{isFirstOfGroup && <BotAvatar emoji={bot.emoji} color={bot.color} name={bot.name} working={working && streaming} />}</div>
      <div className="relative min-w-0 flex-1">
        {isFirstOfGroup && (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[15px] font-bold text-ink" style={{ backgroundColor: botSoftColor(bot.color) }}>
              {bot.name}
            </span>
            {timeLine}
            {m.branch_index > 0 && <span className="text-[11px] font-semibold text-muted-foreground">· attempt {m.branch_index + 1}</span>}
          </div>
        )}
        {!streaming && <ActionsMenu m={m} mine={false} models={models} actions={actions} onStartEdit={() => undefined} />}
        {segment(m.parts).map((seg, i) => (seg.kind === SegmentKinds.STEPS ? <ActivitySteps key={`s${i}`} steps={seg.steps} mode={activityMode} working={streaming && working} runId={m.run_id} /> : renderPart(seg.part, seg.index)))}
        {streaming && working && !hasText && !m.parts.some((p) => p.type === MessagePartTypes.APPROVAL || p.type === MessagePartTypes.SECRET_INPUT) && <TypingDots color={bot.color} />}
        {m.status === MessageStatuses.STOPPED && !hasText && <p className="text-xs text-muted-foreground">Stopped.</p>}
        <Reactions m={m} meId={meId} onReact={(e) => actions.onReact(m, e)} align={ReactionAligns.START} />
        {followUps && !streaming && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followUps.items.map((f) => (
              <button key={f} type="button" onClick={() => actions.onFollowUp(f)} className="min-h-[34px] rounded-full border-[1.5px] border-hairline-strong bg-surface px-3 py-1 text-left text-[13px] font-semibold text-body shadow-sticker hover:border-primary hover:text-primary">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
MessageItem.displayName = "MessageItem";
