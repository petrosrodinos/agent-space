import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronRight, LayoutDashboard, MoreHorizontal, Pencil, Table2, Trash2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useDeleteWidget, useWidgets } from "@/features/widgets/hooks/use-widgets";
import type { Widget } from "@/features/widgets/interfaces/widgets.interfaces";
import { timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { EditWidgetDialog } from "./components/edit-widget-dialog";

/** §7.4 saved widgets: interactive replies the user kept. Opening one rebuilds it with fresh data. */
const WidgetsPage: FC = () => {
  const { data, isPending } = useWidgets();
  const remove = useDeleteWidget();
  const [editing, setEditing] = useState<Widget | null>(null);
  const [deleting, setDeleting] = useState<Widget | null>(null);

  return (
    <PageContainer>
      <PageHeader title="Widgets" description="Interactive replies you saved. Open one to see it with fresh data." />
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-lg" />)}</div>
      ) : !data?.length ? (
        <EmptyState
          title="No widgets yet"
          description='When a bot replies with a dashboard, table or chart, choose "Save as widget" on it to keep it here.'
          stickers={[{ icon: LayoutDashboard, color: "#6B4EFF" }, { icon: BarChart3, color: "#1FC98E" }, { icon: Table2, color: "#FF7A3D" }]}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((w) => (
            <li key={w.id} className="card-lift flex items-center gap-2 rounded-lg border border-hairline bg-surface p-3 shadow-sticker sm:p-4">
              <Link to={Routes.widgets.detail(w.id)} className="flex min-w-0 flex-1 items-center gap-3">
                {w.bot ? <BotAvatar emoji={w.bot.emoji} color={w.bot.color} name={w.bot.name} /> : <LayoutDashboard className="h-9 w-9 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{w.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {w.bot?.name ?? "Bot deleted"} · updated {timeAgo(w.refreshed_at)}
                  </p>
                  {w.refresh_error && <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-warning">{w.refresh_error}</p>}
                </div>
                <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Actions for ${w.title}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={() => setEditing(w)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-error focus:text-error" onSelect={() => setDeleting(w)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      <EditWidgetDialog widget={editing} onClose={() => setEditing(null)} />
      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="The widget is removed. The conversation it came from is not affected."
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </PageContainer>
  );
};

export default WidgetsPage;
