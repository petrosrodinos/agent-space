import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, EyeOff, File as FileIcon, Folder, Globe, Home, LogOut, Pause, Play, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { StatusPill } from "@/components/ui/status-pill";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMPUTER_STATUS_TONE, ComputerViewer } from "@/components/layout/computer-viewer";
import {
  useComputer, useComputerFiles, useComputerSessions, useDeleteComputerFile, useImportToComputer, usePauseComputer, useReplayFrames, useResetComputer, useSignedInWebsites, useSignOutWebsite, useStartComputer,
} from "@/features/computers/hooks/use-computers";
import { downloadComputerFile } from "@/features/computers/services/computers.services";
import type { ComputerFileEntry, ComputerSession } from "@/features/computers/interfaces/computers.interfaces";
import { uploadFile } from "@/features/files/services/files.services";
import { useUpdateBot } from "@/features/bots/hooks/use-bots";
import type { Bot } from "@/features/bots/interfaces/bots.interfaces";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { formatBytes, formatDateTime, timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { ComputerStatuses, ComputerSessionKinds } from "@/features/computers/interfaces/computers.interfaces";
import { ComputerStatusOptions } from "@/config/constants/dropdowns/computers/computer.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ALL_FILTER } from "@/config/constants/filters";

const WORKSPACE = "/home/daytona/workspace";

/** §9 — the bot's cloud computer: on/off, live view, files, signed-in websites and replays. */
export const ComputerTab: FC<{ bot: Bot }> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const { data: computer, isPending } = useComputer(bot.id);
  const start = useStartComputer(bot.id);
  const pause = usePauseComputer(bot.id);
  const reset = useResetComputer(bot.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const [watching, setWatching] = useState(false);

  if (isPending || !computer) return <Skeleton className="h-40 w-full rounded-lg" />;
  const st = { label: getDropdownOptionLabel(ComputerStatusOptions, computer.status), tone: COMPUTER_STATUS_TONE[computer.status] };
  const running = computer.status === ComputerStatuses.RUNNING;

  return (
    <div className="space-y-4">
      <SettingsCard title="Cloud computer" description="A private computer in the cloud where this bot can browse websites, work with files and run small programs. It pauses when idle and keeps its files and website sign-ins.">
        <SettingRow
          label="Give this bot a cloud computer"
          description={!computer.available ? "Cloud computers aren't available — your organisation has turned them off or limited them to Owners and Admins." : undefined}
        >
          <Switch checked={bot.cloud_computer_enabled} disabled={!bot.can_edit || !computer.available || update.isPending} onCheckedChange={(v) => update.mutate({ cloud_computer_enabled: v })} aria-label="Cloud computer" />
        </SettingRow>
        {bot.cloud_computer_enabled && (
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            <span className="text-xs text-muted-foreground">
              {computer.total_minutes} min used{computer.last_active_at ? ` · active ${timeAgo(computer.last_active_at)}` : ""}
            </span>
            <span className="flex-1" />
            {!running && (
              <Button size="sm" loading={start.isPending} disabled={!computer.available} onClick={() => start.mutate(undefined, { onSuccess: () => setWatching(true) })}>
                <Play /> Turn on
              </Button>
            )}
            {running && (
              <Button size="sm" variant="outline" loading={pause.isPending} onClick={() => pause.mutate(undefined)}>
                <Pause /> Pause
              </Button>
            )}
            {bot.can_edit && computer.status !== ComputerStatuses.OFF && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
        )}
        {computer.status_message && <p className="pt-2 text-sm text-error">{computer.status_message}</p>}
      </SettingsCard>

      {bot.cloud_computer_enabled && computer.available && (
        <>
          <SettingsCard title="Live view" description="Watch the bot work, or take control to sign in to a website or show it something.">
            {watching || running ? (
              <ComputerViewer botId={bot.id} className="mt-2" />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-surface-sunken p-6 text-center">
                <p className="text-sm text-muted-foreground">The computer is {computer.status === ComputerStatuses.OFF ? "off" : "paused"}. Opening it turns it on.</p>
                <Button variant="outline" onClick={() => setWatching(true)}>
                  <Play /> Open the computer
                </Button>
              </div>
            )}
          </SettingsCard>
          {running && <FilesCard botId={bot.id} />}
          {computer.status !== ComputerStatuses.OFF && <WebsitesCard botId={bot.id} canEdit={bot.can_edit} running={running} />}
          <ReplaysCard botId={bot.id} />
        </>
      )}

      <ConfirmationDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the cloud computer?"
        description="This deletes the computer with all its files and website sign-ins. The bot gets a fresh computer next time. This can't be undone."
        confirmText="Reset"
        variant="destructive"
        isLoading={reset.isPending}
        onConfirm={() => reset.mutate(undefined, { onSuccess: () => { setConfirmReset(false); setWatching(false); } })}
      />
    </div>
  );
};

const FilesCard: FC<{ botId: string }> = ({ botId }) => {
  const [path, setPath] = useState(WORKSPACE);
  const { data, isPending, error } = useComputerFiles(botId, path);
  const del = useDeleteComputerFile(botId);
  const imp = useImportToComputer(botId);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<ComputerFileEntry | null>(null);
  const crumbs = path.replace(/^\/home\/daytona\/?/, "").split("/").filter(Boolean);

  const upload = async () => {
    const files = await platform.files.pick({ multiple: true });
    if (!files.length) return;
    setUploading(true);
    for (const f of files.slice(0, 10)) {
      try {
        const stored = await uploadFile(f, "chat");
        await imp.mutateAsync({ file_id: stored.id, folder: path });
      } catch (e) {
        toast({ title: `Could not copy ${f.name}`, description: (e as Error).message, variant: "error" });
      }
    }
    setUploading(false);
  };

  return (
    <SettingsCard
      title="Files"
      description="Files on the computer stay there while the bot works. Downloading copies them to you."
      actions={
        <Button size="sm" variant="outline" onClick={upload} loading={uploading}>
          <Upload /> Upload
        </Button>
      }
    >
      <nav className="flex flex-wrap items-center gap-1 pb-2 text-sm" aria-label="Folder">
        <button type="button" className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-semibold text-primary hover:bg-surface-sunken" onClick={() => setPath("/home/daytona")}>
          <Home className="h-3.5 w-3.5" /> Home
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button type="button" className="rounded-sm px-1.5 py-0.5 font-semibold text-ink hover:bg-surface-sunken" onClick={() => setPath(`/home/daytona/${crumbs.slice(0, i + 1).join("/")}`)}>
              {c}
            </button>
          </span>
        ))}
      </nav>
      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="py-3 text-sm text-error">{(error as Error).message}</p>
      ) : !data?.entries.length ? (
        <p className="py-3 text-sm text-muted-foreground">This folder is empty.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.entries.map((e) => (
            <li key={e.path} className="flex items-center gap-2 py-2">
              {e.is_dir ? <Folder className="h-4 w-4 shrink-0 text-primary" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {e.is_dir ? (
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink hover:underline" onClick={() => setPath(e.path)}>
                  {e.name}
                </button>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatBytes(e.size)}</span>
                </span>
              )}
              {!e.is_dir && (
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Download ${e.name}`} onClick={() => downloadComputerFile(botId, e.path).catch((err) => toast({ title: "Download failed", description: (err as Error).message, variant: "error" }))}>
                  <Download />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${e.name}`} onClick={() => setRemoving(e)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        description={removing?.is_dir ? "The folder and everything in it are deleted from the computer." : "The file is deleted from the computer."}
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.path, { onSuccess: () => setRemoving(null) })}
      />
    </SettingsCard>
  );
};

const WebsitesCard: FC<{ botId: string; canEdit: boolean; running: boolean }> = ({ botId, canEdit, running }) => {
  const { data, isPending } = useSignedInWebsites(botId);
  const signOut = useSignOutWebsite(botId);
  const [target, setTarget] = useState<string | typeof ALL_FILTER | null>(null);
  return (
    <SettingsCard
      title="Signed-in websites"
      description="Agent Space never stores website passwords — the computer's browser keeps the signed-in session, so the bot can use the site again later."
      actions={canEdit && !!data?.length ? <Button size="sm" variant="outline" onClick={() => setTarget(ALL_FILTER)}><LogOut /> Sign out of all</Button> : undefined}
    >
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : !data?.length ? (
        <p className="py-3 text-sm text-muted-foreground">{running ? "Not signed in to any websites." : "Turn the computer on to see its sign-ins."}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{w.domain}</span>
                <span className="block text-xs text-muted-foreground">Since {formatDateTime(w.signed_in_at)}</span>
              </span>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setTarget(w.domain)}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={target === ALL_FILTER ? "Sign out of all websites?" : `Sign out of ${target}?`}
        description="The bot will need to be signed in again before it can use the site. The browser on the computer is closed first."
        confirmText="Sign out"
        variant="destructive"
        isLoading={signOut.isPending}
        onConfirm={() => target && signOut.mutate(target === ALL_FILTER ? null : target, { onSuccess: () => setTarget(null) })}
      />
    </SettingsCard>
  );
};

const ReplaysCard: FC<{ botId: string }> = ({ botId }) => {
  const { data, isPending } = useComputerSessions(botId);
  const [open, setOpen] = useState<ComputerSession | null>(null);
  return (
    <SettingsCard title="Replays" description="A timeline of what the bot did on its computer, one screenshot per step. Time when you had control is never recorded.">
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : !data?.length ? (
        <p className="py-3 text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {s.kind === ComputerSessionKinds.BOT_RUN ? (s.run?.title ?? "Bot task") : `Opened by ${s.user?.name ?? "a member"}`}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(s.started_at)} · {s.ended_at ? `${s.minutes} min` : "in progress"}
                  {s.hidden_ranges?.length ? " · Sign-in hidden" : ""}
                </span>
              </span>
              {s.run?.conversation_id && (
                <Button asChild variant="ghost" size="sm">
                  <Link to={Routes.chat.conversation(s.run.conversation_id)}>Chat</Link>
                </Button>
              )}
              {s.frames > 0 && (
                <Button variant="outline" size="sm" onClick={() => setOpen(s)}>
                  <Play /> {s.frames} steps
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ReplayDialog botId={botId} session={open} onClose={() => setOpen(null)} />
    </SettingsCard>
  );
};

const ReplayDialog: FC<{ botId: string; session: ComputerSession | null; onClose: () => void }> = ({ botId, session, onClose }) => {
  const { data: frames, isPending } = useReplayFrames(botId, session?.id ?? null);
  const [i, setI] = useState(0);
  const frame = frames?.[Math.min(i, (frames?.length ?? 1) - 1)];
  return (
    <Dialog open={!!session} onOpenChange={(o) => { if (!o) { onClose(); setI(0); } }}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{session?.run?.title ?? "Replay"}</DialogTitle>
          <DialogDescription>
            {session ? formatDateTime(session.started_at) : ""}
            {session?.hidden_ranges?.length ? " · parts where you had control are hidden" : ""}
          </DialogDescription>
        </DialogHeader>
        {isPending || !frame ? (
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
        ) : (
          <div className="space-y-3">
            <img src={frame.url} alt={frame.label} className="aspect-[4/3] w-full rounded-md border border-hairline bg-[#1C1633] object-contain" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Previous step" disabled={i === 0} onClick={() => setI((v) => Math.max(0, v - 1))}>
                <ChevronLeft />
              </Button>
              <input
                type="range"
                min={0}
                max={(frames?.length ?? 1) - 1}
                value={i}
                onChange={(e) => setI(Number(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
                aria-label="Step"
              />
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Next step" disabled={i >= (frames?.length ?? 1) - 1} onClick={() => setI((v) => Math.min((frames?.length ?? 1) - 1, v + 1))}>
                <ChevronRight />
              </Button>
            </div>
            <p className="text-sm text-body">
              <span className="font-bold text-ink">
                {i + 1}/{frames?.length}
              </span>{" "}
              {frame.label} · <span className="text-muted-foreground">{formatDateTime(frame.at)}</span>
            </p>
            {session?.hidden_ranges?.length ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" /> Sign-in hidden
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
