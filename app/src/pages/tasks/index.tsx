import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, CheckCircle2, ChevronRight, Coffee, PartyPopper, Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTasks } from "@/features/tasks/hooks/use-tasks";
import { TaskFilterOptions } from "@/config/constants/dropdowns/shared/status.options";
import { formatMoney, timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { TaskStatus } from "./components/task-status";
import { NewTaskDialog } from "./components/new-task-dialog";
import { TaskFilters } from "@/config/constants/filters";
import { RunStatuses } from "@/features/tasks/interfaces/tasks.interfaces";

type Filter = (typeof TaskFilterOptions)[number]["id"];

const TasksPage: FC = () => {
  const [filter, setFilter] = useState<Filter>(TaskFilters.ALL);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isPending } = useTasks(filter === TaskFilters.ALL ? undefined : filter, page);

  return (
    <PageContainer>
      <PageHeader title="Tasks" description="Everything your bots are working on, waiting for, finished or failed." actions={<><Button variant="outline" asChild><Link to={Routes.automations.root}><AlarmClock /> Automations</Link></Button><Button onClick={() => setOpen(true)}><Plus /> New task</Button></>} />
      <SegmentedControl ariaLabel="Filter tasks" value={filter} options={TaskFilterOptions} onChange={(v) => { setFilter(v); setPage(1); }} className="mb-5" />
      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-lg" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState title="All caught up" description="Give a bot a long job and it'll keep working even after you leave." stickers={[{ icon: PartyPopper, color: "#1FC98E" }, { icon: CheckCircle2, color: "#6B4EFF" }, { icon: Coffee, color: "#FF7A3D" }]} action={<Button size="lg" onClick={() => setOpen(true)}><Plus /> New task</Button>} />
      ) : (
        <>
          <ul className="space-y-2">
            {data.data.map((t) => (
              <li key={t.id}>
                <Link to={Routes.tasks.detail(t.id)} className="card-lift flex items-center gap-3 rounded-lg border border-hairline bg-surface p-3 shadow-sticker sm:p-4">
                  <BotAvatar seed={t.bot.avatar_seed} color={t.bot.color} name={t.bot.name} working={t.status === RunStatuses.RUNNING} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.bot.name}{t.conversation?.name ? ` · ${t.conversation.name}` : ""} · {t.steps} step{t.steps === 1 ? "" : "s"} · {formatMoney(t.cost)} · {timeAgo(t.queued_at)}
                    </p>
                  </div>
                  <div className="hidden sm:block"><TaskStatus status={t.status} /></div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
                <div className="mt-1 pl-14 sm:hidden"><TaskStatus status={t.status} /></div>
              </li>
            ))}
          </ul>
          {data.pagination.total_pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={!data.pagination.has_prev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.total_pages}</span>
              <Button variant="outline" size="sm" disabled={!data.pagination.has_next} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
      <NewTaskDialog open={open} onClose={() => setOpen(false)} />
    </PageContainer>
  );
};

export default TasksPage;
