import { useState, type FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, CalendarClock, ChevronRight, Copy, Mailbox, MoreHorizontal, Pause, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { AutomationStatusFilterOptions } from "@/config/constants/dropdowns/automations/automation-form.options";
import { useAutomations, useDeleteAutomation, useDuplicateAutomation, usePauseAutomation, useResumeAutomation, useRunAutomationNow } from "@/features/automations/hooks/use-automations";
import type { Automation, AutomationStatus as Status } from "@/features/automations/interfaces/automations.interfaces";
import { formatDateTime, timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { AutomationRunStatusPill, AutomationStatus } from "./components/automation-status";
import { AutomationFormDialog } from "./components/automation-form-dialog";
import { AutomationStatuses, AutomationRunStatuses } from "@/features/automations/interfaces/automations.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

type Filter = (typeof AutomationStatusFilterOptions)[number]["id"];

const RowActions: FC<{ a: Automation; onDelete: () => void }> = ({ a, onDelete }) => {
  const pause = usePauseAutomation();
  const resume = useResumeAutomation();
  const run = useRunAutomationNow();
  const duplicate = useDuplicateAutomation();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Actions for ${a.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => run.mutate(a.id)}><Zap className="h-4 w-4" /> Run now</DropdownMenuItem>
        {a.status === AutomationStatuses.ACTIVE ? (
          <DropdownMenuItem onSelect={() => pause.mutate(a.id)}><Pause className="h-4 w-4" /> Pause</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => resume.mutate(a.id)}><Play className="h-4 w-4" /> Resume</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => duplicate.mutate(a.id, { onSuccess: (c) => navigate(Routes.automations.detail(c.id)) })}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error focus:text-error" onSelect={onDelete}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** §10.2 "Managing automations": every automation the user owns, with status and next/last run. */
const AutomationsPage: FC = () => {
  const [filter, setFilter] = useState<Filter>(ALL_FILTER);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Automation | null>(null);
  const { data, isPending } = useAutomations(filter === ALL_FILTER ? undefined : (filter as Status));
  const remove = useDeleteAutomation();

  return (
    <PageContainer>
      <PageHeader title="Automations" description="Jobs your bots do by themselves, on a schedule." actions={<Button onClick={() => setOpen(true)}><Plus /> New automation</Button>} />
      <SegmentedControl ariaLabel="Filter automations" value={filter} options={AutomationStatusFilterOptions} onChange={setFilter} className="mb-5" />
      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-lg" />)}</div>
      ) : !data?.length ? (
        <EmptyState
          title={filter === ALL_FILTER ? "No automations yet" : "Nothing here"}
          description={filter === ALL_FILTER ? 'Ask any bot something like "Every morning at 8, summarise my unread emails" — or set one up here.' : "Try another filter."}
          stickers={[{ icon: AlarmClock, color: "#6B4EFF" }, { icon: Repeat, color: "#1FC98E" }, { icon: Mailbox, color: "#FF7A3D" }]}
          action={filter === ALL_FILTER ? <Button size="lg" onClick={() => setOpen(true)}><Plus /> New automation</Button> : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className="card-lift flex items-center gap-2 rounded-lg border border-hairline bg-surface p-3 shadow-sticker sm:gap-3 sm:p-4">
              <Link to={Routes.automations.detail(a.id)} className="flex min-w-0 flex-1 items-center gap-3">
                <BotAvatar emoji={a.bot.emoji} color={a.bot.color} name={a.bot.name} working={a.last_run?.status === AutomationRunStatuses.RUNNING} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-bold text-ink">{a.name}</p>
                    <AutomationStatus status={a.status} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {a.schedule_description ?? "Manual"} · {a.bot.name}
                      {a.status === AutomationStatuses.ACTIVE && a.next_run_at ? ` · next ${formatDateTime(a.next_run_at)}` : ""}
                    </span>
                  </p>
                  {a.status !== AutomationStatuses.ACTIVE && a.status_reason && <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-warning">{a.status_reason}</p>}
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
                  {a.last_run ? (
                    <>
                      <AutomationRunStatusPill status={a.last_run.status} />
                      <span className="text-xs text-muted-foreground">{timeAgo(a.last_run.created_at)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not run yet</span>
                  )}
                </div>
                <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
              </Link>
              <RowActions a={a} onDelete={() => setDeleting(a)} />
            </li>
          ))}
        </ul>
      )}
      <AutomationFormDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="It stops running and its memory and run history are deleted."
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </PageContainer>
  );
};

export default AutomationsPage;
