import { useEffect, useRef, useState, type FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, MessageSquare, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { UiBlockView } from "@/components/ui/ui-blocks";
import { useDeleteWidget, useRefreshWidget, useWidget } from "@/features/widgets/hooks/use-widgets";
import { timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Routes } from "@/routes/routes";
import { EditWidgetDialog } from "../../components/edit-widget-dialog";

/** One saved widget (§7.4). It shows the last version straight away and asks the bot for fresh data on open. */
const WidgetDetailPage: FC = () => {
  const { widgetId = "" } = useParams();
  const navigate = useNavigate();
  const { data: w, isPending, error } = useWidget(widgetId);
  const refresh = useRefreshWidget();
  const remove = useDeleteWidget();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  // Fresh data each time it's opened.
  useEffect(() => {
    if (!w || refreshedFor.current === w.id) return;
    refreshedFor.current = w.id;
    refresh.mutate(w.id);
  }, [w, refresh]);

  if (isPending) {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-9 w-64" />
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      </PageContainer>
    );
  }
  if (!w) {
    return (
      <PageContainer>
        <EmptyState title="Can't open this widget" description={(error as Error)?.message ?? "It may have been deleted."} action={<Button onClick={() => navigate(Routes.widgets.root)}>All widgets</Button>} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={w.title}
        backTo={Routes.widgets.root}
        description={`${w.bot?.name ?? "Bot deleted"} · ${refresh.isPending ? "getting fresh data…" : `updated ${timeAgo(w.refreshed_at)}`}`}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh.mutate(w.id)} disabled={refresh.isPending || !w.bot}>
              <RefreshCw className={cn(refresh.isPending && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="Edit widget"><Pencil /></Button>
            {w.conversation_id && (
              <Button variant="outline" size="icon" asChild aria-label="Open the conversation it came from">
                <Link to={Routes.chat.conversation(w.conversation_id)}><MessageSquare /></Link>
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setDeleting(true)} aria-label="Delete widget"><Trash2 /></Button>
          </>
        }
      />
      {w.refresh_error && !refresh.isPending && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-hairline bg-surface p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn't get fresh data: {w.refresh_error} Showing the last version.
        </p>
      )}
      <section className={cn("space-y-3 rounded-lg border border-hairline bg-surface p-4 shadow-sticker transition-opacity sm:p-5", refresh.isPending && "opacity-60")} aria-busy={refresh.isPending}>
        {w.blocks.length ? w.blocks.map((b, i) => <UiBlockView key={i} block={b} onAction={() => undefined} disabled />) : <p className="text-sm text-muted-foreground">{w.fallback_text || "Nothing to show yet."}</p>}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">Buttons and forms work in the conversation the widget came from.</p>
      <EditWidgetDialog widget={editing ? w : null} onClose={() => setEditing(false)} />
      <ConfirmationDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete "${w.title}"?`}
        description="The widget is removed. The conversation it came from is not affected."
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(w.id, { onSuccess: () => navigate(Routes.widgets.root) })}
      />
    </PageContainer>
  );
};

export default WidgetDetailPage;
