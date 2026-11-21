import { DesktopAppCard } from "./desktop-app-card";
import { DesktopDownloadCard } from "./desktop-download-card";
import { AndroidAppCard } from "./android-app-card";
import { AppLockCard } from "./app-lock-card";
import { VoicePicker } from "@/components/layout/voice-picker";
import { useEffect, useMemo, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Laptop,
  LogOut,
  Monitor,
  Pencil,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { DeviceToolsCard } from "./device-tools-card";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangePassword, useSignOut } from "@/features/auth/hooks/use-auth";
import {
  useDeleteAccount,
  useDevices,
  useMe,
  useRenameDevice,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useSignOutDevice,
  useUpdateColorTheme,
  useUpdateProfile,
  useUpdateSettings,
} from "@/features/users/hooks/use-users";
import { useOrganizationStore } from "@/stores/organization";
import { platform } from "@/platform";
import { ColorThemePicker } from "./color-theme-picker";
import type { UserSettings } from "@/features/users/interfaces/users.interfaces";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useUpdateNotificationPreference,
  usePushNotifications,
  useDesktopNotifications,
} from "@/features/notifications/hooks/use-notifications";
import type { NotificationChannel } from "@/features/notifications/interfaces/notifications.interfaces";
import {
  useAddOrgMemory,
  useBots,
  useClearAllMemories,
  useMyMemories,
  useOrgMemories,
} from "@/features/bots/hooks/use-bots";
import { MemoryList } from "./memory-list";
import {
  ActivityStepsOptions,
  AppLanguageOptions,
  ApprovalChannelOptions,
  ApprovalTimeoutOptions,
  ClarifyingQuestionsOptions,
  ConversationRetentionOptions,
  DevicePlatformOptions,
  GroupReplyModeOptions,
  LayoutDensityOptions,
  ReplyLanguageOptions,
  SendWithOptions,
  TaskCheckInOptions,
  TextSizeOptions,
  ThemeOptions,
  TimeFormatOptions,
  SpeakingSpeedOptions,
  VoiceInputModeOptions,
} from "@/config/constants/dropdowns/users/user-settings-form.options";
import {
  EmojiUsageOptions,
  ReplyFormattingOptions,
  ReplyLengthOptions,
  ReplyToneOptions,
  ApprovalLevelFormOptions,
} from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import {
  NotificationChannelOptions,
  NotificationEventOptions,
} from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, timeAgo } from "@/lib/date";
import { useNavigate } from "react-router-dom";
import {
  SegmentSetting,
  SelectSetting,
  SwitchSetting,
} from "./setting-controls";
import { TimezonePicker } from "./timezone-picker";
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordFormValues,
  type ProfileFormValues,
} from "../validation-schemas/settings.schema";
import { PickerValues } from "@/config/constants/filters";
import { PermissionStates, DEFAULT_TIMEZONE } from "@/config/constants/browser.constants";
import { Platforms } from "@/features/users/interfaces/users.interfaces";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const useSettings = () => {
  const { data } = useMe();
  const update = useUpdateSettings({ silent: true });
  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) =>
    update.mutate({ [k]: v } as Partial<UserSettings>);
  return { s: data?.settings, set };
};

export const SettingsSkeleton: FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 2 }).map((_, i) => (
      <Skeleton key={i} className="h-64 rounded-lg" />
    ))}
  </div>
);

export const ProfileSection: FC = () => {
  const { data } = useMe();
  const update = useUpdateProfile();
  const defaults = useMemo<ProfileFormValues | null>(() => {
    if (!data) return null;
    const wh = data.user.working_hours ?? {};
    return {
      name: data.user.name ?? "",
      job_title: data.user.job_title ?? "",
      about_me: data.user.about_me ?? "",
      timezone: data.user.timezone || DEFAULT_TIMEZONE,
      work_start: wh.start ?? "09:00",
      work_end: wh.end ?? "18:00",
      work_days: wh.days ?? [1, 2, 3, 4, 5],
    };
  }, [data]);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: defaults ?? undefined,
  });
  if (!defaults) return <SettingsSkeleton />;
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          update.mutate({
            name: v.name,
            job_title: v.job_title || null,
            about_me: v.about_me || null,
            timezone: v.timezone,
            working_hours: {
              days: v.work_days,
              start: v.work_start,
              end: v.work_end,
            },
          }),
        )}
      >
        <SettingsCard
          title="Profile"
          description="Bots use this for context about you."
        >
          <div className="space-y-4 py-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job title</FormLabel>
                  <FormControl>
                    <Input placeholder="Head of Sales" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="about_me"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About me</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Your role, responsibilities and how you like to work"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Email: <strong className="text-ink">{data?.user.email}</strong>{" "}
              (change it in Security)
            </p>
          </div>
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <SettingRow label="Time zone">
                <TimezonePicker value={field.value} onChange={field.onChange} />
              </SettingRow>
            )}
          />
          <SettingRow
            label="Working hours"
            description="Bots avoid scheduling or notifying you outside them."
            stack
          >
            <div className="flex flex-wrap items-center gap-2">
              <FormField
                control={form.control}
                name="work_start"
                render={({ field }) => (
                  <Input
                    type="time"
                    className="w-[130px]"
                    aria-label="Start"
                    {...field}
                  />
                )}
              />
              <span className="text-muted-foreground">to</span>
              <FormField
                control={form.control}
                name="work_end"
                render={({ field }) => (
                  <Input
                    type="time"
                    className="w-[130px]"
                    aria-label="End"
                    {...field}
                  />
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="work_days"
              render={({ field }) => (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = field.value.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          field.onChange(
                            on
                              ? field.value.filter((x) => x !== i)
                              : [...field.value, i].sort(),
                          )
                        }
                        className={`min-h-[40px] min-w-[48px] rounded-full px-3 text-sm font-bold ${on ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-body"}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </SettingRow>
          <div className="flex justify-end pt-3">
            <Button
              type="submit"
              loading={update.isPending}
              disabled={!form.formState.isDirty}
            >
              Save profile
            </Button>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
};

export const AppearanceSection: FC = () => {
  const { s, set } = useSettings();
  const { data: me } = useMe();
  const currentOrgId = useOrganizationStore((st) => st.current_id);
  const updateColorTheme = useUpdateColorTheme();
  const currentOrg = me?.organizations.find((o) => o.id === currentOrgId);
  if (!s) return <SettingsSkeleton />;
  return (
    <SettingsCard title="Appearance">
      <SegmentSetting
        label="Mode"
        value={s.theme}
        options={ThemeOptions}
        onChange={(v) => set("theme", v)}
      />
      {currentOrg && (
        <SettingRow
          label="Colour theme"
          description={
            <>
              Applies to you in <strong className="text-ink">{currentOrg.name}</strong> only. Each organisation keeps its own theme.
            </>
          }
          stack
        >
          <ColorThemePicker
            value={currentOrg.color_theme}
            onChange={(v) => updateColorTheme.mutate(v)}
          />
        </SettingRow>
      )}
      <SegmentSetting
        label="Text size"
        value={s.text_size}
        options={TextSizeOptions}
        onChange={(v) => set("text_size", v)}
      />
      <SegmentSetting
        label="Layout density"
        value={s.layout_density}
        options={LayoutDensityOptions}
        onChange={(v) => set("layout_density", v)}
      />
      <SelectSetting
        label="App language"
        value={s.app_language}
        options={AppLanguageOptions}
        onChange={(v) => set("app_language", v as UserSettings["app_language"])}
      />
      <SelectSetting
        label="Date and time format"
        value={s.time_format}
        options={TimeFormatOptions}
        onChange={(v) => set("time_format", v as UserSettings["time_format"])}
      />
    </SettingsCard>
  );
};

export const RepliesSection: FC = () => {
  const { s, set } = useSettings();
  const { data: bots } = useBots();
  if (!s) return <SettingsSkeleton />;
  return (
    <div className="space-y-4">
      <SettingsCard
        title="How bots reply to me"
        description="Bots use these unless a bot locks its own style."
      >
        <SegmentSetting
          label="Reply length"
          value={s.reply_length}
          options={ReplyLengthOptions}
          onChange={(v) => set("reply_length", v)}
        />
        <SelectSetting
          label="Tone"
          value={s.reply_tone}
          options={ReplyToneOptions}
          onChange={(v) => set("reply_tone", v as UserSettings["reply_tone"])}
        />
        <SelectSetting
          label="Formatting"
          value={s.reply_formatting}
          options={ReplyFormattingOptions}
          onChange={(v) =>
            set("reply_formatting", v as UserSettings["reply_formatting"])
          }
        />
        <SegmentSetting
          label="Emoji in replies"
          value={s.emoji_usage}
          options={EmojiUsageOptions}
          onChange={(v) => set("emoji_usage", v)}
        />
        <SelectSetting
          label="Reply language"
          value={s.reply_language}
          options={ReplyLanguageOptions}
          onChange={(v) =>
            set("reply_language", v as UserSettings["reply_language"])
          }
        />
        <SelectSetting
          label="Clarifying questions"
          value={s.clarifying_questions}
          options={ClarifyingQuestionsOptions}
          onChange={(v) =>
            set(
              "clarifying_questions",
              v as UserSettings["clarifying_questions"],
            )
          }
        />
        <SwitchSetting
          label="Show sources"
          description="Where information came from (links, emails, files)."
          checked={s.show_sources}
          onChange={(v) => set("show_sources", v)}
        />
        <SwitchSetting
          label="Suggested follow-ups"
          checked={s.suggested_follow_ups}
          onChange={(v) => set("suggested_follow_ups", v)}
        />
        <SwitchSetting
          label="Proactive suggestions"
          checked={s.proactive_suggestions}
          onChange={(v) => set("proactive_suggestions", v)}
        />
        <SwitchSetting
          label="Suggest saving repeated tasks as skills"
          checked={s.suggest_skills}
          onChange={(v) => set("suggest_skills", v)}
        />
        <SelectSetting
          label="Activity steps in chat"
          value={s.activity_steps_display}
          options={ActivityStepsOptions}
          onChange={(v) =>
            set(
              "activity_steps_display",
              v as UserSettings["activity_steps_display"],
            )
          }
        />
        <SwitchSetting
          label="Interactive replies"
          description="Bots may reply with charts, forms and other interactive screens."
          checked={s.interactive_replies}
          onChange={(v) => set("interactive_replies", v)}
        />
      </SettingsCard>
      <SettingsCard title="Chat behaviour">
        <SelectSetting
          label="Default bot"
          value={s.default_bot_id ?? "none"}
          options={[
            { id: "none", label: "None" },
            ...(bots ?? []).map((b) => ({
              id: b.id,
              label: `${b.emoji} ${b.name}`,
            })),
          ]}
          onChange={(v) => set("default_bot_id", v === PickerValues.NONE ? null : v)}
        />
        <SelectSetting
          label="Send with"
          value={s.send_with}
          options={SendWithOptions}
          onChange={(v) => set("send_with", v as UserSettings["send_with"])}
        />
        <SelectSetting
          label="In groups, bots reply"
          value={s.group_reply_mode}
          options={GroupReplyModeOptions}
          onChange={(v) =>
            set("group_reply_mode", v as UserSettings["group_reply_mode"])
          }
        />
        <SwitchSetting
          label="Show typing/working indicators"
          checked={s.show_typing_indicators}
          onChange={(v) => set("show_typing_indicators", v)}
        />
      </SettingsCard>
      <SettingsCard
        title="Voice mode"
        description="Talk with bots out loud with the waveform button next to the message box."
      >
        <SettingRow
          label="Voice for all bots"
          description="Leave on “Each bot's voice” to hear every bot in its own voice."
        >
          <VoicePicker
            value={s.voice_override}
            defaultLabel="Each bot's voice"
            onChange={(v) => set("voice_override", v)}
          />
        </SettingRow>
        <SegmentSetting
          label="Speaking speed"
          value={s.speaking_speed}
          options={SpeakingSpeedOptions}
          onChange={(v) => set("speaking_speed", v)}
        />
        <SegmentSetting
          label="How I talk"
          description="Hands-free detects when you've finished speaking; push to talk listens only while you hold the button."
          value={s.voice_input_mode}
          options={VoiceInputModeOptions}
          onChange={(v) => set("voice_input_mode", v)}
        />
      </SettingsCard>
      <SettingsCard title="Approvals and tasks">
        <SelectSetting
          label="Default approval level for my new bots"
          value={s.default_approval_level}
          options={ApprovalLevelFormOptions}
          onChange={(v) =>
            set(
              "default_approval_level",
              v as UserSettings["default_approval_level"],
            )
          }
        />
        <SelectSetting
          label="If I don't respond to an approval"
          value={s.approval_timeout}
          options={ApprovalTimeoutOptions}
          onChange={(v) =>
            set("approval_timeout", v as UserSettings["approval_timeout"])
          }
        />
        <SelectSetting
          label="Where approvals reach me"
          value={s.approval_channel}
          options={ApprovalChannelOptions}
          onChange={(v) =>
            set("approval_channel", v as UserSettings["approval_channel"])
          }
        />
        <SwitchSetting
          label="Notify me when a task finishes"
          checked={s.notify_task_finished}
          onChange={(v) => set("notify_task_finished", v)}
        />
        <SelectSetting
          label="Check in if a task runs longer than"
          value={s.task_check_in}
          options={TaskCheckInOptions}
          onChange={(v) =>
            set("task_check_in", v as UserSettings["task_check_in"])
          }
        />
      </SettingsCard>
    </div>
  );
};

export const NotificationsSection: FC = () => {
  const { s, set } = useSettings();
  const { data: prefs, isPending } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const { data: list } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const navigate = useNavigate();
  const [qh, setQh] = useState({ start: "22:00", end: "07:00" });
  useEffect(() => {
    if (s)
      setQh({
        start: s.quiet_hours_start ?? "22:00",
        end: s.quiet_hours_end ?? "07:00",
      });
  }, [s]);
  if (!s) return <SettingsSkeleton />;
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Recent"
        actions={
          !!list?.unread && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </Button>
          )
        }
      >
        {!list?.data.length ? (
          <p className="py-4 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {list.data.slice(0, 10).map((n) => (
              <li key={n.id}>
                <button
                  className="flex w-full items-start gap-3 py-3 text-left"
                  onClick={() => {
                    if (!n.read_at) markOne.mutate(n.id);
                    if (n.link_path) navigate(n.link_path);
                  }}
                >
                  <span
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {n.body}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      <PushDeviceCard />
      <SettingsCard
        title="Quiet hours"
        description="Push and email wait until quiet hours end. Urgent approvals still come through."
      >
        <SwitchSetting
          label="Quiet hours"
          checked={s.quiet_hours_enabled}
          onChange={(v) => set("quiet_hours_enabled", v)}
        />
        {s.quiet_hours_enabled && (
          <SettingRow label="From – to">
            <div className="flex items-center gap-2">
              <Input
                type="time"
                className="w-[120px]"
                value={qh.start}
                onChange={(e) =>
                  setQh((q) => ({ ...q, start: e.target.value }))
                }
                onBlur={() => set("quiet_hours_start", qh.start)}
                aria-label="Quiet hours start"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="time"
                className="w-[120px]"
                value={qh.end}
                onChange={(e) => setQh((q) => ({ ...q, end: e.target.value }))}
                onBlur={() => set("quiet_hours_end", qh.end)}
                aria-label="Quiet hours end"
              />
            </div>
          </SettingRow>
        )}
        <SwitchSetting
          label="Daily email digest"
          checked={s.daily_email_digest}
          onChange={(v) => set("daily_email_digest", v)}
        />
        <SwitchSetting
          label="Sounds"
          checked={s.sounds_enabled}
          onChange={(v) => set("sounds_enabled", v)}
        />
      </SettingsCard>
      <SettingsCard title="Events and channels">
        {isPending ? (
          <div className="space-y-2 py-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {prefs?.map((p) => (
              <div
                key={p.event}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3">
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={(v) =>
                      updatePref.mutate({
                        event: p.event,
                        enabled: v,
                        channels: p.channels,
                      })
                    }
                    aria-label={getDropdownOptionLabel(
                      NotificationEventOptions,
                      p.event,
                      p.event,
                    )}
                  />
                  <span className="font-semibold text-ink">
                    {getDropdownOptionLabel(
                      NotificationEventOptions,
                      p.event,
                      p.event,
                    )}
                  </span>
                </div>
                <div className="flex gap-4 pl-[56px] sm:pl-0">
                  {NotificationChannelOptions.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-1.5 text-sm text-body"
                    >
                      <Checkbox
                        checked={p.channels.includes(
                          c.id as NotificationChannel,
                        )}
                        disabled={!p.enabled}
                        onCheckedChange={(v) =>
                          updatePref.mutate({
                            event: p.event,
                            enabled: p.enabled,
                            channels: v
                              ? [...p.channels, c.id as NotificationChannel]
                              : p.channels.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};

/** Desktop app: system notifications while the app runs in the background. */
const DesktopNotificationsCard: FC = () => {
  const desktop = useDesktopNotifications();
  return (
    <SettingsCard title="This device">
      <SettingRow label="Desktop notifications" description="Get notified about approvals, finished tasks and mentions while Agent Space is running in the background.">
        <Switch checked={desktop.enabled} onCheckedChange={desktop.set} aria-label="Desktop notifications on this device" />
      </SettingRow>
    </SettingsCard>
  );
};

/** This device's notifications: system notifications in the desktop app, push everywhere else (§12). */
const PushDeviceCard: FC = () => {
  if (platform.is("desktop")) return <DesktopNotificationsCard />;
  return <WebPushDeviceCard />;
};

const WebPushDeviceCard: FC = () => {
  const push = usePushNotifications();
  const description = !push.supported
    ? "This browser doesn't support push notifications."
    : !push.available && !push.loading
      ? "Push notifications aren't set up on this server yet."
      : push.permission === PermissionStates.DENIED
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then turn this on."
        : "Get notified about approvals, finished tasks and mentions even when Agent Space is closed.";
  return (
    <SettingsCard title="This device">
      <SettingRow label="Push notifications" description={description}>
        <Switch
          checked={push.enabled}
          disabled={
            !push.supported ||
            !push.available ||
            push.loading ||
            push.toggle.isPending
          }
          onCheckedChange={(v) => push.toggle.mutate(v)}
          aria-label="Push notifications on this device"
        />
      </SettingRow>
    </SettingsCard>
  );
};

export const MemorySection: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { s, set } = useSettings();
  const clear = useClearAllMemories();
  const myMemories = useMyMemories();
  const orgMemories = useOrgMemories();
  const add = useAddOrgMemory();
  const [fact, setFact] = useState("");
  const [confirm, setConfirm] = useState(false);
  if (!s) return <SettingsSkeleton />;
  return (
    <div className="space-y-4">
      <SettingsCard title="Memory and personalisation">
        <SwitchSetting
          label="Let bots remember things about me"
          checked={s.memory_enabled}
          onChange={(v) => set("memory_enabled", v)}
        />
        <SwitchSetting
          label="Use my past conversations for context"
          checked={s.use_past_conversations}
          onChange={(v) => set("use_past_conversations", v)}
        />
        <SelectSetting
          label="Auto-delete my conversations after"
          value={s.auto_delete_conversations}
          options={ConversationRetentionOptions}
          onChange={(v) =>
            set(
              "auto_delete_conversations",
              v as UserSettings["auto_delete_conversations"],
            )
          }
        />
        <SwitchSetting
          label="Permanently delete my deleted artifacts after 30 days"
          description="When off, deleted artifacts stay in the Deleted tab and can be restored at any time."
          checked={s.purge_deleted_artifacts}
          onChange={(v) => set("purge_deleted_artifacts", v)}
        />
      </SettingsCard>
      <SettingsCard
        title="What bots remember about you"
        description="Facts bots have learned from your conversations. Edit or delete anything."
        actions={
          !!myMemories.data?.length && (
            <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
              Clear all
            </Button>
          )
        }
      >
        <MemoryList
          memories={myMemories.data}
          isPending={myMemories.isPending}
          emptyText="Nothing remembered yet."
          meta={(m) => m.bot?.name ?? null}
        />
      </SettingsCard>
      {isAdmin && (
        <SettingsCard
          title="Organisation memory"
          description="Company facts every bot can use (products, tone of voice, key contacts)."
        >
          <MemoryList
            memories={orgMemories.data}
            isPending={orgMemories.isPending}
            emptyText="No company facts yet."
          />
          <div className="flex items-center gap-2 pt-3">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Our fiscal year starts in April"
                value={fact}
                onChange={(e) => setFact(e.target.value)}
                aria-label="New company fact"
              />
            </div>
            <Button
              disabled={!fact.trim()}
              loading={add.isPending}
              onClick={() =>
                add.mutate(fact.trim(), { onSuccess: () => setFact("") })
              }
            >
              Add
            </Button>
          </div>
        </SettingsCard>
      )}
      <ConfirmationDialog
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        title="Clear all memories?"
        description="Every bot forgets what it remembered about you. This can't be undone."
        confirmText="Clear all"
        variant="destructive"
        isLoading={clear.isPending}
        onConfirm={() =>
          clear.mutate(undefined, { onSuccess: () => setConfirm(false) })
        }
      />
    </div>
  );
};

export const SecuritySection: FC = () => {
  const change = useChangePassword();
  const { data: sessions, isPending } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const del = useDeleteAccount();
  const signOut = useSignOut();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });
  return (
    <div className="space-y-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) =>
            change.mutate(
              {
                current_password: v.current_password,
                new_password: v.new_password,
              },
              { onSuccess: () => form.reset() },
            ),
          )}
        >
          <SettingsCard
            title="Password"
            description="Security settings can only be changed here, never by asking a bot."
          >
            <div className="grid gap-4 py-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={change.isPending}>
                Change password
              </Button>
            </div>
          </SettingsCard>
        </form>
      </Form>
      <AppLockCard />
      <SettingsCard
        title="Active sessions"
        actions={
          <Button
            size="sm"
            variant="outline"
            loading={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out everywhere else
          </Button>
        }
      >
        {isPending ? (
          <div className="space-y-2 py-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {sessions?.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-3">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {x.device?.name ?? "Browser"}{" "}
                    {x.current && (
                      <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {x.ip_address ?? "Unknown IP"} · last active{" "}
                    {timeAgo(x.last_used_at)}
                  </p>
                </div>
                {!x.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke.mutate(x.id)}
                  >
                    <LogOut /> Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      <SettingsCard title="Delete account">
        <SettingRow
          label="Delete my account"
          description="Your personal data is removed. Hand over ownership of shared organisations first."
        >
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 /> Delete account
          </Button>
        </SettingRow>
      </SettingsCard>
      <Dialog
        open={deleting}
        onOpenChange={(o) => !o && !del.isPending && setDeleting(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This is permanent. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleting(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!password}
              loading={del.isPending}
              onClick={() =>
                del.mutate(password, { onSuccess: () => signOut.mutate() })
              }
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const DevicesSection: FC = () => {
  const { data, isPending } = useDevices();
  const rename = useRenameDevice();
  const signOut = useSignOutDevice();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <DesktopAppCard />
      <DeviceToolsCard />
      <DesktopDownloadCard />
      <AndroidAppCard />
      <SettingsCard
        title="My devices"
        description="Browsers and apps signed in to Agent Space."
      >
        {isPending ? (
          <div className="space-y-2 py-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {data?.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                {d.platform === Platforms.ANDROID ? (
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Laptop className="h-5 w-5 text-muted-foreground" />
                )}
                {editing?.id === d.id ? (
                  <div className="flex flex-1 gap-2">
                    <Input
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                      aria-label="Device name"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      loading={rename.isPending}
                      onClick={() =>
                        rename.mutate(
                          { id: d.id, name: editing.name },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getDropdownOptionLabel(
                        DevicePlatformOptions,
                        d.platform,
                      )}{" "}
                      · v{d.app_version ?? "1.0.0"} · last seen{" "}
                      {formatDateTime(d.last_seen_at)}
                    </p>
                  </div>
                )}
                {editing?.id !== d.id && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => setEditing({ id: d.id, name: d.name })}
                      aria-label="Rename"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => setRemoving(d.id)}
                      aria-label="Sign out"
                    >
                      <LogOut />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <ConfirmationDialog
          isOpen={!!removing}
          onClose={() => setRemoving(null)}
          title="Sign out of this device?"
          description="It will need to sign in again."
          confirmText="Sign out"
          variant="destructive"
          isLoading={signOut.isPending}
          onConfirm={() =>
            removing &&
            signOut.mutate(removing, { onSuccess: () => setRemoving(null) })
          }
        />
      </SettingsCard>
    </div>
  );
};
