import { useState, type FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Copy, MoreHorizontal, Pause, Play, Trash2, Zap } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { AutomationTabOptions, type AutomationTab } from "@/config/constants/dropdowns/automations/automation-form.options";
import { useAutomation, useDeleteAutomation, useDuplicateAutomation, usePauseAutomation, useResumeAutomation, useRunAutomationNow } from "@/features/automations/hooks/use-automations";
import { formatDateTime } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { AutomationStatus } from "../../components/automation-status";
import { OverviewTab } from "../../components/overview-tab";
import { RunsTab } from "../../components/runs-tab";
import { MemoryTab } from "../../components/memory-tab";
import { AutomationTabs, AutomationStatuses } from "@/features/automations/interfaces/automations.interfaces";

const AutomationDetailPage: FC = () => {
  const { automationId = "" } = useParams();
  const { data: a, isPending, isError } = useAutomation(automationId);
  const [tab, setTab] = useState<AutomationTab>(AutomationTabs.OVERVIEW);
  const [deleting, setDeleting] = useState(false);
  const pause = usePauseAutomation();
  const resume = useResumeAutomation();
  const run = useRunAutomationNow();
  const duplicate = useDuplicateAutomation();
  const remove = useDeleteAutomation();
  const navigate = useNavigate();

  if (isPending)
    return (
      <PageContainer>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-80 rounded-lg" />
      </PageContainer>
    );
  if (isError || !a)
    return (
      <PageContainer>
        <EmptyState title="Automation not found" description="It may have been deleted, or it belongs to someone else." action={<Button asChild><Link to={Routes.automations.root}>Back to automations</Link></Button>} />
      </PageContainer>
    );

  return (
    <PageContainer>
      <Link to={Routes.automations.root} className="mb-4 hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink md:inline-flex">
        <ArrowLeft className="h-4 w-4" /> Automations
      </Link>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton fallback={Routes.automations.root} className="mr-1 md:hidden" />
            <h1 className="min-w-0 break-words font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{a.name}</h1>
            <AutomationStatus status={a.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {a.schedule_description ?? "Manual"}
            {a.status === AutomationStatuses.ACTIVE && a.next_run_at && <span>· next {formatDateTime(a.next_run_at)}</span>}
            {a.last_run_at && <span>· last {formatDateTime(a.last_run_at)}</span>}
            <span>· {a.run_count} run{a.run_count === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => run.mutate(a.id)} loading={run.isPending} disabled={a.is_running}>
            <Zap /> {a.is_running ? "Running…" : "Run now"}
          </Button>
          {a.status === AutomationStatuses.ACTIVE ? (
            <Button variant="outline" onClick={() => pause.mutate(a.id)} loading={pause.isPending}><Pause /> Pause</Button>
          ) : (
            <Button onClick={() => resume.mutate(a.id)} loading={resume.isPending}><Play /> Resume</Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => duplicate.mutate(a.id, { onSuccess: (c) => navigate(Routes.automations.detail(c.id)) })}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-error focus:text-error" onSelect={() => setDeleting(true)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SegmentedControl ariaLabel="Automation sections" value={tab} options={AutomationTabOptions} onChange={setTab} className="mb-5" />
      {tab === AutomationTabs.OVERVIEW && <OverviewTab automation={a} />}
      {tab === AutomationTabs.RUNS && <RunsTab automationId={a.id} />}
      {tab === AutomationTabs.MEMORY && <MemoryTab automationId={a.id} plan={a.memory_plan} />}

      <ConfirmationDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete "${a.name}"?`}
        description="It stops running and its memory and run history are deleted."
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(a.id, { onSuccess: () => navigate(Routes.automations.root) })}
      />
    </PageContainer>
  );
};

export default AutomationDetailPage;
