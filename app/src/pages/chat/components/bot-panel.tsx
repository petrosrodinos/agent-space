import {
  Children,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Clock,
  ListChecks,
  Monitor,
  Pencil,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { KnowledgePanel } from "@/components/layout/knowledge-panel";
import { VoicePicker } from "@/components/layout/voice-picker";
import { useBot, useDeleteBot, useUpdateBot } from "@/features/bots/hooks/use-bots";
import {
  useBotAutomations,
  usePauseAutomation,
  useResumeAutomation,
} from "@/features/automations/hooks/use-automations";
import { useBotTasks } from "@/features/tasks/hooks/use-tasks";
import { useComputer } from "@/features/computers/hooks/use-computers";
import { useStopRun } from "@/features/conversations/hooks/use-conversations";
import type { Bot } from "@/features/bots/interfaces/bots.interfaces";
import type { Automation } from "@/features/automations/interfaces/automations.interfaces";
import { AutomationStatuses } from "@/features/automations/interfaces/automations.interfaces";
import { ACTIVE_RUN_STATUSES } from "@/features/tasks/interfaces/tasks.interfaces";
import {
  BotPanelTabs,
  type BotPanelTab,
} from "@/features/bots/interfaces/bots.interfaces";
import { BotPanelTabOptions } from "@/config/constants/dropdowns/bots/bot-panel.options";
import { AutomationStatusOptions } from "@/config/constants/dropdowns/automations/automation-form.options";
import { ComputerStatusOptions } from "@/config/constants/dropdowns/computers/computer.options";
import { RunStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Routes } from "@/routes/routes";
import { ComputerSheet } from "./computer-sheet";

const ACTIVE: string[] = ACTIVE_RUN_STATUSES;
/** Delay between consecutive sections fading in. */
const STAGGER_MS = 45;

/** Fades and lifts each child in, one after another. */
const Stagger: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={className}>
    {Children.toArray(children).map((child, i) => (
      <div
        key={i}
        className="animate-slide-up"
        style={{ animationDelay: `${i * STAGGER_MS}ms` }}
      >
        {child}
      </div>
    ))}
  </div>
);

/** Grok-style section: small muted title over a rounded card of rows. */
const Section: FC<{
  title: string;
  children: ReactNode;
  action?: ReactNode;
}> = ({ title, children, action }) => (
  <section>
    <div className="mb-1.5 flex items-center justify-between px-3">
      <h3 className="text-[13px] font-semibold text-muted-foreground">
        {title}
      </h3>
      {action}
    </div>
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker">
      {children}
    </div>
  </section>
);

const ROW =
  "flex w-full min-h-[52px] items-center gap-3 border-b border-hairline px-3 py-2 text-left last:border-b-0";

const Row: FC<{
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
}> = ({ icon, title, subtitle, trailing, to, onClick }) => {
  const body = (
    <>
      {icon && (
        <span className="flex w-5 shrink-0 justify-center text-muted-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-[13px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );
  // The clickable area excludes the trailing control so a switch never also navigates.
  const interactive =
    "flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left";
  return (
    <div
      className={cn(
        ROW,
        "group/row",
        (to || onClick) &&
          "transition-colors duration-150 hover:bg-surface-sunken/60",
      )}
    >
      {to ? (
        <Link to={to} className={interactive}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={interactive}>
          {body}
        </button>
      ) : (
        <span className={interactive}>{body}</span>
      )}
      {trailing}
    </div>
  );
};

const EmptyRow: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="px-3 py-3 text-[13px] text-muted-foreground">{children}</p>
);

/** Click-to-rename bot name (Enter saves, Escape cancels). */
const EditableName: FC<{ bot: Bot }> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bot.name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(bot.name), [bot.name]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const save = () => {
    const name = value.trim();
    setEditing(false);
    if (name && name !== bot.name) update.mutate({ name });
    else setValue(bot.name);
  };

  if (editing)
    return (
      <Input
        ref={input}
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(bot.name);
            setEditing(false);
          }
        }}
        aria-label="Bot name"
        className="mt-3 h-10 max-w-[260px] animate-pop-in text-center text-[18px] font-bold"
      />
    );
  return (
    <button
      type="button"
      disabled={!bot.can_edit}
      onClick={() => setEditing(true)}
      className="group mt-3 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[20px] font-bold text-ink transition-colors duration-150 enabled:hover:bg-surface-sunken disabled:cursor-default"
      aria-label={bot.can_edit ? `Rename ${bot.name}` : bot.name}
    >
      <span className="truncate">{bot.name}</span>
      {bot.can_edit && (
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}
    </button>
  );
};

const automationSubtitle = (a: Automation) => {
  if (a.status === AutomationStatuses.NEEDS_ATTENTION)
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <AlertTriangle className="h-3 w-3" />{" "}
        {a.status_reason ??
          getDropdownOptionLabel(AutomationStatusOptions, a.status)}
      </span>
    );
  if (a.status === AutomationStatuses.PAUSED)
    return `${a.schedule_description ?? "Paused"} · paused`;
  return (
    a.schedule_description ??
    (a.next_run_at
      ? `Next ${formatDateTime(a.next_run_at)}`
      : getDropdownOptionLabel(AutomationStatusOptions, a.status))
  );
};

const AutomationsSection: FC<{ bot: Bot }> = ({ bot }) => {
  const { data, isPending } = useBotAutomations(bot.id);
  const pause = usePauseAutomation();
  const resume = useResumeAutomation();
  const busyId =
    (pause.isPending && pause.variables) ||
    (resume.isPending && resume.variables) ||
    null;
  return (
    <Section title="Upcoming">
      {isPending ? (
        <Skeleton className="m-3 h-10 rounded-md" />
      ) : data?.length ? (
        data.map((a) => (
          <Row
            key={a.id}
            icon={<Clock />}
            title={a.name}
            subtitle={automationSubtitle(a)}
            to={Routes.automations.detail(a.id)}
            trailing={
              <Switch
                checked={a.status !== AutomationStatuses.PAUSED}
                disabled={busyId === a.id}
                onCheckedChange={(on) =>
                  on ? resume.mutate(a.id) : pause.mutate(a.id)
                }
                aria-label={`${a.name} on or off`}
              />
            }
          />
        ))
      ) : (
        <EmptyRow>
          No automations yet. Ask {bot.name} to do something on a schedule, like
          a morning briefing.
        </EmptyRow>
      )}
    </Section>
  );
};

const TasksSection: FC<{ bot: Bot }> = ({ bot }) => {
  const { data, isPending } = useBotTasks(bot.id);
  const stop = useStopRun();
  const tasks = data?.data ?? [];
  return (
    <Section
      title="Tasks"
      action={
        tasks.length > 0 && (
          <Link
            to={Routes.tasks.root}
            className="text-[13px] font-semibold text-muted-foreground hover:text-ink"
          >
            See all
          </Link>
        )
      }
    >
      {isPending ? (
        <Skeleton className="m-3 h-10 rounded-md" />
      ) : tasks.length ? (
        tasks.map((t) => {
          const running = ACTIVE.includes(t.status);
          return (
            <Row
              key={t.id}
              icon={<ListChecks />}
              title={t.title}
              subtitle={`${getDropdownOptionLabel(RunStatusOptions, t.status, t.status)} · ${timeAgo(t.queued_at)}`}
              to={Routes.tasks.detail(t.id)}
              trailing={
                running && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    onClick={() => stop.mutate(t.id)}
                    aria-label={`Stop ${t.title}`}
                  >
                    <Square className="!h-3 !w-3 fill-current" />
                  </Button>
                )
              }
            />
          );
        })
      ) : (
        <EmptyRow>
          No tasks yet. Long jobs you give {bot.name} show up here.
        </EmptyRow>
      )}
    </Section>
  );
};

const ComputerSection: FC<{ bot: Bot }> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const { data: computer } = useComputer(bot.id, bot.cloud_computer_enabled);
  const [watching, setWatching] = useState(false);
  return (
    <Section title="Computer">
      <Row
        icon={<Monitor />}
        title={`${bot.name}'s computer`}
        subtitle={
          bot.cloud_computer_enabled
            ? computer
              ? getDropdownOptionLabel(
                  ComputerStatusOptions,
                  computer.status,
                  computer.status,
                )
              : "Loading…"
            : "Off — the bot can't browse or run programs"
        }
        onClick={
          bot.cloud_computer_enabled ? () => setWatching(true) : undefined
        }
        trailing={
          bot.can_edit ? (
            <Switch
              checked={bot.cloud_computer_enabled}
              disabled={update.isPending}
              onCheckedChange={(v) =>
                update.mutate({ cloud_computer_enabled: v })
              }
              aria-label="Cloud computer"
            />
          ) : (
            bot.cloud_computer_enabled && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )
        }
      />
      {bot.cloud_computer_enabled && (
        <ComputerSheet
          bots={[bot]}
          open={watching}
          onOpenChange={setWatching}
        />
      )}
    </Section>
  );
};

const VoiceSection: FC<{ bot: Bot }> = ({ bot }) => {
  const update = useUpdateBot(bot.id);
  const ro = !bot.can_edit;
  return (
    <Section title="Voice chat">
      <Row
        title="Voice mode"
        subtitle="Talk out loud, in real time"
        trailing={
          <Switch
            checked={bot.voice_mode_enabled}
            disabled={ro || update.isPending}
            onCheckedChange={(v) => update.mutate({ voice_mode_enabled: v })}
            aria-label="Voice mode"
          />
        }
      />
      <div className={cn(ROW, "flex-wrap justify-between")}>
        <span className="text-[14px] font-semibold text-ink">Voice</span>
        <VoicePicker
          value={bot.voice}
          disabled={ro || !bot.voice_mode_enabled}
          onChange={(v) => update.mutate({ voice: v })}
          triggerClassName="w-[170px] h-9"
        />
      </div>
    </Section>
  );
};

const DeleteSection: FC<{ bot: Bot }> = ({ bot }) => {
  const del = useDeleteBot();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  return (
    <Section title="Danger zone">
      <Row
        icon={<Trash2 className="text-error" />}
        title={<span className="text-error">Delete bot</span>}
        subtitle="Removes the bot and its chat from your sidebar"
        onClick={() => setConfirm(true)}
      />
      <ConfirmationDialog
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${bot.name}?`}
        description="The bot will be removed from your chats. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() =>
          del.mutate(bot.id, {
            onSuccess: () => navigate(Routes.chat.root, { replace: true }),
          })
        }
      />
    </Section>
  );
};

/**
 * Bot side panel (Grok-style): avatar, click-to-rename name, Activity (automations, tasks, computer, voice) and Library.
 * Shown for the bot of a direct chat, and for a bot opened from a group's details (`onBack` returns to the group).
 */
export const BotPanel: FC<{
  botId: string;
  working: boolean;
  onClose?: () => void;
  onBack?: () => void;
  menu?: ReactNode;
}> = ({ botId, working, onClose, onBack, menu }) => {
  const { data: bot, isPending } = useBot(botId);
  const [tab, setTab] = useState<BotPanelTab>(BotPanelTabs.ACTIVITY);

  return (
    <div className="flex h-full flex-col">
      {(menu || onClose || onBack) && (
        <div className="flex items-center justify-between gap-2 px-3 pt-3">
          {onBack ? (
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={onBack} aria-label="Back to group details">
              <ArrowLeft />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {menu}
            {onClose && (
              <Button
                variant="outline"
                size="icon"
                className="group/close h-10 w-10 rounded-full transition-transform duration-200 active:scale-90"
                onClick={onClose}
                aria-label="Close panel"
              >
                <X className="transition-transform duration-200 ease-[var(--ease-bounce)] group-hover/close:rotate-90" />
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {isPending || !bot ? (
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-[88px] w-[88px] rounded-2xl" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="mt-6 h-40 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <div className="flex animate-pop-in flex-col items-center text-center">
              <BotAvatar
                emoji={bot.emoji}
                color={bot.color}
                name={bot.name}
                size={88}
                working={working}
                followCursor
              />
              <EditableName bot={bot} />
              {bot.description && (
                <p className="mt-0.5 line-clamp-2 max-w-[300px] text-[13px] text-muted-foreground">
                  {bot.description}
                </p>
              )}
              <SegmentedControl
                className="mt-4"
                value={tab}
                options={BotPanelTabOptions}
                onChange={setTab}
                ariaLabel="Bot panel section"
              />
            </div>

            {tab === BotPanelTabs.ACTIVITY ? (
              <Stagger key={tab} className="mt-5 space-y-5">
                <AutomationsSection bot={bot} />
                <TasksSection bot={bot} />
                <ComputerSection bot={bot} />
                <VoiceSection bot={bot} />
                <Section title="Settings">
                  <Row
                    icon={<Settings2 />}
                    title="All bot settings"
                    subtitle="Behaviour, skills, connections, memory…"
                    to={Routes.bots.detail(bot.id)}
                    trailing={
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover/row:translate-x-0.5" />
                    }
                  />
                </Section>
                {bot.can_edit && !bot.is_starter && <DeleteSection bot={bot} />}
              </Stagger>
            ) : (
              <div key={tab} className="mt-5 animate-slide-up">
                <KnowledgePanel
                  botId={bot.id}
                  canEdit={bot.can_edit}
                  title="Library"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
