import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Loader2, X, Clock, Square, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useUndoStep } from "@/features/tasks/hooks/use-tasks";
import { MessagePartTypes, ToolPartStatuses, type MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";
import { ActivityStepsDisplays, type ActivityStepsDisplay } from "@/features/users/interfaces/users.interfaces";
import { toolIcon } from "@/config/constants/tool-icons";
import { formatDuration } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

type ToolPart = Extract<MessagePart, { type: typeof MessagePartTypes.TOOL }>;
type SourcesPart = Extract<MessagePart, { type: typeof MessagePartTypes.SOURCES }>;
/** One entry of an activity block: a step, or the sources a step found (shown under it). */
export type ActivityItem = ToolPart | SourcesPart;

const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Numbered source chips (web search results). */
export const SourceChips: FC<{ sources: SourcesPart["sources"]; className?: string }> = ({ sources, className }) => (
  <div className={cn("flex flex-wrap gap-1.5", className)}>
    {sources.map((s, j) => (
      <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-body hover:border-primary hover:text-primary">
        {j + 1}. {s.title || sourceHost(s.url)}
      </a>
    ))}
  </div>
);

const StepIcon: FC<{ status: ToolPart["status"] }> = ({ status }) =>
  status === ToolPartStatuses.RUNNING ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  ) : status === ToolPartStatuses.DONE ? (
    <Check className="h-3.5 w-3.5 text-mint" strokeWidth={3} />
  ) : status === ToolPartStatuses.ERROR ? (
    <X className="h-3.5 w-3.5 text-error" strokeWidth={3} />
  ) : status === ToolPartStatuses.STOPPED ? (
    <Square className="h-3 w-3 text-muted-foreground" />
  ) : (
    <Clock className="h-3.5 w-3.5 text-warning" />
  );

/**
 * Live activity feed (§7.3): pill chips per step, with the sources a step found under it. Collapsed into one summary
 * pill by default ("7 steps · 1m 12s · 32 sources"), expanded while the bot is still working.
 * Honours the "Activity steps in chat" setting (hidden still shows the sources).
 */
export const ActivitySteps: FC<{ items: ActivityItem[]; mode: ActivityStepsDisplay; working: boolean; runId?: string | null }> = ({ items, mode, working, runId }) => {
  const steps = items.filter((x): x is ToolPart => x.type === MessagePartTypes.TOOL);
  const sourceCount = items.reduce((n, x) => (x.type === MessagePartTypes.SOURCES ? n + x.sources.length : n), 0);
  const [open, setOpen] = useState(mode === ActivityStepsDisplays.EXPANDED);
  const [confirm, setConfirm] = useState<ToolPart | null>(null);
  const undo = useUndoStep();
  if (mode === ActivityStepsDisplays.HIDDEN || !steps.length) {
    const sources = items.flatMap((x) => (x.type === MessagePartTypes.SOURCES ? x.sources : []));
    return sources.length ? <SourceChips sources={sources} className="my-1.5" /> : null;
  }
  // §16 Undo: shown while the window is open, even when the steps are collapsed.
  const undoable = runId && !working ? steps.filter((s) => s.undo && !s.undone && new Date(s.undo.until).getTime() > Date.now()) : [];
  const expanded = open || working;
  const total = steps.reduce((s, x) => s + (x.duration_ms ?? 0), 0);
  const failed = steps.filter((s) => s.status === ToolPartStatuses.ERROR).length;

  return (
    <div className="my-1.5">
      {!working && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-[13px] font-semibold text-muted-foreground hover:text-ink" aria-expanded={expanded}>
          <Check className="h-3.5 w-3.5 text-mint" strokeWidth={3} />
          {steps.length} {steps.length === 1 ? "step" : "steps"}
          {total > 0 && ` · ${formatDuration(total)}`}
          {sourceCount > 0 && ` · ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`}
          {failed > 0 && <span className="text-error">· {failed} failed</span>}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
      {expanded && (
        <ul className="mt-1.5 flex flex-col items-start gap-1.5" aria-live="polite">
          {items.map((s, i) => {
            if (s.type === MessagePartTypes.SOURCES)
              return (
                <li key={`sources-${i}`} className="w-full">
                  <SourceChips sources={s.sources} />
                </li>
              );
            const ToolIcon = toolIcon(s.name);
            return (
            <li key={s.call_id} className="inline-flex max-w-full animate-pop-in items-center gap-2 rounded-full bg-surface-sunken px-3 py-1.5 text-[13px] text-muted-foreground">
              <StepIcon status={s.status} />
              <ToolIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className={cn("truncate", s.undone && "line-through")}>{s.title}</span>
              {s.undone && <span className="shrink-0 font-semibold">· undone</span>}
              {s.status === ToolPartStatuses.ERROR && s.error && <span className="truncate text-error">— {s.error}</span>}
            </li>
            );
          })}
          {!working && runId && (
            <li>
              <Link to={Routes.tasks.detail(runId)} className="px-1 text-xs font-bold text-primary hover:underline">
                View details
              </Link>
            </li>
          )}
        </ul>
      )}
      {!!undoable.length && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {undoable.map((s) => (
            <Button key={s.step_id} type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setConfirm(s)} disabled={undo.isPending}>
              <Undo2 /> Undo: {s.undo!.label}
            </Button>
          ))}
        </div>
      )}
      <ConfirmationDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={`${confirm?.undo?.label ?? "Undo"}?`}
        description={`This reverses "${confirm?.title ?? ""}" in the connected service. It can't be redone.`}
        confirmText="Undo"
        variant="destructive"
        isLoading={undo.isPending}
        onConfirm={() => confirm && runId && undo.mutate({ runId, stepId: confirm.step_id }, { onSettled: () => setConfirm(null) })}
      />
    </div>
  );
};
