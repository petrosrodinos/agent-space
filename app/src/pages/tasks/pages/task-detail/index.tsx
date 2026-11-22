import { useState, type FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, CircleDashed, Loader2, MessageCircle, Square, XCircle } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsCard } from "@/components/ui/setting-row";
import { useTask } from "@/features/tasks/hooks/use-tasks";
import { useStopRun } from "@/features/conversations/hooks/use-conversations";
import { ACTIVE_RUN_STATUSES, WAITING_RUN_STATUSES, type RunStep, RunStepStatuses, RunStatuses } from "@/features/tasks/interfaces/tasks.interfaces";
import { ApprovalStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { TaskStatus } from "../../components/task-status";

const StepIcon: FC<{ status: RunStep["status"] }> = ({ status }) =>
  status === RunStepStatuses.COMPLETED ? (
    <CheckCircle2 className="h-5 w-5 text-mint" />
  ) : status === RunStepStatuses.FAILED ? (
    <XCircle className="h-5 w-5 text-error" />
  ) : status === RunStepStatuses.RUNNING ? (
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
  ) : (
    <CircleDashed className="h-5 w-5 text-muted-foreground" />
  );

const StepRow: FC<{ step: RunStep }> = ({ step }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = step.input != null || step.output != null || !!step.error;
  return (
    <li className="py-3">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => hasDetail && setOpen((o) => !o)} aria-expanded={open}>
        <StepIcon status={step.status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{step.title}</span>
          <span className="text-xs text-muted-foreground">
            {step.tool_name} · {formatDuration(step.duration_ms)}
          </span>
        </span>
        {hasDetail && <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-8">
          {step.error && <p className="rounded-sm bg-error-soft p-2 text-sm text-ink">{step.error}</p>}
          {step.input != null && (
            <div>
              <p className="eyebrow mb-1">Input</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs">{JSON.stringify(step.input, null, 2)}</pre>
            </div>
          )}
          {step.output != null && (
            <div>
              <p className="eyebrow mb-1">Result</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs">{JSON.stringify(step.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

const TaskDetailPage: FC = () => {
  const { taskId = "" } = useParams();
  const { data: task, isPending, isError } = useTask(taskId);
  const stop = useStopRun();
  const navigate = useNavigate();
  const back = (
    <>
      <Button variant="ghost" size="sm" className="mb-3 hidden md:inline-flex" onClick={() => navigate(Routes.tasks.root)}>
        <ArrowLeft /> Tasks
      </Button>
      <div className="mb-3 md:hidden">
        <BackButton fallback={Routes.tasks.root} />
      </div>
    </>
  );
  if (isPending)
    return (
      <PageContainer>
        {back}
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="mt-4 h-72 rounded-lg" />
      </PageContainer>
    );
  if (isError || !task)
    return (
      <PageContainer>
        {back}
        <EmptyState title="Task not found" />
      </PageContainer>
    );
  const active = ACTIVE_RUN_STATUSES.includes(task.status) || WAITING_RUN_STATUSES.includes(task.status);
  return (
    <PageContainer>
      {back}
      <div className="mb-4 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sticker sm:flex-row sm:items-center">
        <BotAvatar seed={task.bot.avatar_seed} color={task.bot.color} name={task.bot.name} size={56} working={task.status === RunStatuses.RUNNING} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink">{task.title}</h1>
          <p className="text-sm text-muted-foreground">
            {task.bot.name} · {task.model?.name ?? "model"} · {formatMoney(task.cost)} · {task.input_tokens + task.output_tokens} tokens · started {formatDateTime(task.started_at ?? task.queued_at)}
          </p>
          <div className="mt-2">
            <TaskStatus status={task.status} />
          </div>
          {task.error && <p className="mt-2 rounded-sm bg-error-soft px-3 py-2 text-sm text-ink">{task.error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {task.conversation && (
            <Button variant="outline" asChild>
              <Link to={Routes.chat.conversation(task.conversation.id)}>
                <MessageCircle /> Open chat
              </Link>
            </Button>
          )}
          {active && (
            <Button variant="destructive" loading={stop.isPending} onClick={() => stop.mutate(task.id)}>
              <Square /> Stop
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SettingsCard title="Steps" description="What the bot did, in order.">
          {task.steps.length ? (
            <ol className="divide-y divide-hairline">
              {task.steps.map((s) => (
                <StepRow key={s.id} step={s} />
              ))}
            </ol>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No tool steps — the bot answered directly.</p>
          )}
        </SettingsCard>
        <SettingsCard title="Approvals">
          {task.approvals.length ? (
            <ul className="divide-y divide-hairline">
              {task.approvals.map((a) => (
                <li key={a.id} className="py-3">
                  <Link to={Routes.approvals.detail(a.id)} className="font-semibold text-ink hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {getDropdownOptionLabel(ApprovalStatusOptions, a.status)} · {formatDateTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No approvals were needed.</p>
          )}
        </SettingsCard>
      </div>
    </PageContainer>
  );
};

export default TaskDetailPage;
