import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, Hourglass, Repeat, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAutomationRuns } from "@/features/automations/hooks/use-automations";
import { formatDateTime, formatDuration } from "@/lib/date";
import { formatMoney } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { AutomationRunStatusPill } from "./automation-status";
import { AutomationRunStatuses } from "@/features/automations/interfaces/automations.interfaces";

/** §10.2 run history: status, duration, results, and a link to the steps and the conversation. */
export const RunsTab: FC<{ automationId: string }> = ({ automationId }) => {
  const [page, setPage] = useState(1);
  const { data, isPending } = useAutomationRuns(automationId, page);

  if (isPending) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-[20px]" />)}</div>;
  if (!data?.data.length)
    return <EmptyState title="No runs yet" description="Runs appear here as they happen. Use Run now to try it." stickers={[{ icon: Hourglass, color: "#6B4EFF" }, { icon: Repeat, color: "#1FC98E" }, { icon: ClipboardList, color: "#FF7A3D" }]} />;

  return (
    <div>
      <ul className="space-y-2">
        {data.data.map((r) => (
          <li key={r.id} className="rounded-[20px] border border-hairline bg-surface p-3 shadow-sticker sm:p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <AutomationRunStatusPill status={r.status} />
              {r.is_retry && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" /> Retry</span>
              )}
              <span className="text-sm font-semibold text-ink">{formatDateTime(r.started_at ?? r.created_at)}</span>
              <span className="text-xs text-muted-foreground">
                {r.duration_ms != null ? formatDuration(r.duration_ms) : ""}
                {r.run ? ` · ${r.run._count.steps} step${r.run._count.steps === 1 ? "" : "s"} · ${formatMoney(Number(r.run.cost))}` : ""}
              </span>
              <span className="ml-auto flex gap-1">
                {r.run && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={Routes.tasks.detail(r.run.id)}>Steps</Link>
                  </Button>
                )}
                {r.run?.conversation_id && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={Routes.chat.conversation(r.run.conversation_id)}><ExternalLink /> Result</Link>
                  </Button>
                )}
              </span>
            </div>
            {(r.error || r.result_summary) && <p className={`mt-2 line-clamp-3 text-sm ${r.status === AutomationRunStatuses.FAILED ? "text-error" : "text-body"}`}>{r.status === AutomationRunStatuses.FAILED ? (r.error ?? r.result_summary) : r.result_summary}</p>}
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
    </div>
  );
};
