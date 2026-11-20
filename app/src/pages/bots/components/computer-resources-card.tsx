import { useState, type FC } from "react";
import { Cpu, HardDrive, MemoryStick, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard } from "@/components/ui/setting-row";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCleanupComputer, useComputerResources } from "@/features/computers/hooks/use-computers";
import { CleanupTargets, type CleanupTarget, type ComputerLiveStats } from "@/features/computers/interfaces/computers.interfaces";
import { formatBytes, timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";

const GB = 1024 ** 3;
/** Above this share of a resource the meter turns red. */
const HIGH_USAGE_PERCENT = 85;

const CLEANUP_OPTIONS: { value: CleanupTarget; label: string; description: string; defaultOn: boolean }[] = [
  { value: CleanupTargets.CACHE, label: "Caches", description: "Browser and app caches. Website sign-ins are kept.", defaultOn: true },
  { value: CleanupTargets.TEMP, label: "Temporary files", description: "Leftover files the bot created in the temporary folder.", defaultOn: true },
  { value: CleanupTargets.TRASH, label: "Trash", description: "Files in the desktop's trash.", defaultOn: true },
  {
    value: CleanupTargets.PROGRAMS,
    label: "Close open programs",
    description: "Closes the browser and anything else the bot left running, to free memory. Stops any task the bot is doing on the computer right now.",
    defaultOn: false,
  },
];

const formatUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

const Meter: FC<{ icon: FC<{ className?: string }>; label: string; percent: number; detail: string }> = ({ icon: Icon, label, percent, detail }) => {
  const high = percent >= HIGH_USAGE_PERCENT;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-ink">{label}</span>
        <span className="flex-1" />
        <span className={cn("tabular-nums", high ? "font-semibold text-error" : "text-muted-foreground")}>{Math.round(percent)}%</span>
      </div>
      <Progress value={Math.min(100, percent)} className={cn("h-1.5", high && "bg-error/20 [&>div]:bg-error")} aria-label={`${label} ${Math.round(percent)}%`} />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
};

/** Live CPU, memory and storage of the bot's cloud computer, the programs using the most memory, and "Clean up". */
export const ComputerResourcesCard: FC<{ botId: string; running: boolean; canEdit: boolean }> = ({ botId, running, canEdit }) => {
  const { data, isPending, isFetching, refetch, autoRefreshing, keepFresh } = useComputerResources(botId, running);
  const [cleaning, setCleaning] = useState(false);
  const live = data?.live ?? null;

  return (
    <SettingsCard
      title="Resources"
      description="How much of the computer's processor, memory and storage is in use. Clean up to free space and memory without losing files or sign-ins."
      actions={
        <div className="flex shrink-0 items-center gap-1">
          {running && (
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Refresh" disabled={isFetching} onClick={() => { keepFresh(); refetch(); }}>
              <RefreshCw className={cn(isFetching && "animate-spin")} />
            </Button>
          )}
          {canEdit && running && live && (
            <Button size="sm" variant="outline" onClick={() => setCleaning(true)}>
              <Sparkles /> Clean up
            </Button>
          )}
        </div>
      }
    >
      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : !data?.allocated ? (
        <p className="py-3 text-sm text-muted-foreground">The computer hasn't been created yet. Turn it on to see its resources.</p>
      ) : !live ? (
        <div className="space-y-1 py-3 text-sm">
          <p className="text-ink">
            {data.allocated.cpu} CPU · {data.allocated.memory_gb} GB memory · {data.allocated.disk_gb} GB storage
          </p>
          <p className="text-muted-foreground">{running ? "Couldn't read live usage. Try refreshing." : "Turn the computer on to see live usage."}</p>
        </div>
      ) : (
        <LiveStats live={live} checkedAt={data.checked_at} autoRefreshing={autoRefreshing} />
      )}
      {live && <CleanupDialog botId={botId} live={live} open={cleaning} onClose={() => setCleaning(false)} />}
    </SettingsCard>
  );
};

const LiveStats: FC<{ live: ComputerLiveStats; checkedAt: string; autoRefreshing: boolean }> = ({ live, checkedAt, autoRefreshing }) => {
  const memPct = live.memory.total_bytes ? (live.memory.used_bytes / live.memory.total_bytes) * 100 : 0;
  const diskPct = live.disk.total_bytes ? (live.disk.used_bytes / live.disk.total_bytes) * 100 : 0;
  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <Meter icon={Cpu} label="Processor" percent={live.cpu.percent} detail={`${live.cpu.cores} ${live.cpu.cores === 1 ? "core" : "cores"}`} />
        <Meter icon={MemoryStick} label="Memory" percent={memPct} detail={`${formatBytes(live.memory.used_bytes)} of ${formatBytes(live.memory.total_bytes)}`} />
        <Meter icon={HardDrive} label="Storage" percent={diskPct} detail={`${formatBytes(live.disk.used_bytes)} of ${(live.disk.total_bytes / GB).toFixed(0)} GB`} />
      </div>
      {live.processes.length > 0 && (
        <div>
          <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Using the most memory</p>
          <ul className="divide-y divide-hairline">
            {live.processes.map((p) => (
              <li key={p.pid} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {p.name}
                    {p.protected && <span className="ml-2 text-xs font-normal text-muted-foreground">System</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground" title={p.command}>
                    {p.command}
                  </span>
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{p.cpu_percent}%</span>
                <span className="w-20 shrink-0 text-right tabular-nums text-ink">{formatBytes(p.memory_bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        On for {formatUptime(live.uptime_seconds)} · updated {timeAgo(checkedAt)}
        {!autoRefreshing && " · tap refresh for new numbers"}
      </p>
    </div>
  );
};

const CleanupDialog: FC<{ botId: string; live: ComputerLiveStats; open: boolean; onClose: () => void }> = ({ botId, live, open, onClose }) => {
  const cleanup = useCleanupComputer(botId);
  const [selected, setSelected] = useState<Set<CleanupTarget>>(() => new Set(CLEANUP_OPTIONS.filter((o) => o.defaultOn).map((o) => o.value)));
  const toggle = (v: CleanupTarget, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(v);
      else next.delete(v);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clean up the computer</DialogTitle>
          <DialogDescription>Files in the workspace and website sign-ins are never touched.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {CLEANUP_OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-surface-sunken">
              <Checkbox className="mt-0.5" checked={selected.has(o.value)} onCheckedChange={(v) => toggle(o.value, v === true)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink">{o.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{live.reclaimable[o.value] > 0 ? `about ${formatBytes(live.reclaimable[o.value])}` : "nothing to clear"}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={cleanup.isPending} disabled={!selected.size} onClick={() => cleanup.mutate([...selected], { onSuccess: onClose })}>
            Clean up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
