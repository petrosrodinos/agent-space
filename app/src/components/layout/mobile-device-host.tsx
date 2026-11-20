import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Image as ImageIcon, Loader2, Send, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { realtime } from "@/features/realtime/services/realtime.services";
import { RealtimeStreams, UserEventTypes, type DeviceCall } from "@/features/realtime/interfaces/realtime.interfaces";
import { getTask } from "@/features/tasks/services/tasks.services";
import { ACTIVE_RUN_STATUSES, RunStatuses, RunTypes, WAITING_RUN_STATUSES, type RunStatus, type TaskDetail } from "@/features/tasks/interfaces/tasks.interfaces";
import { setDeviceToolPermission } from "@/features/users/services/users.services";
import { DeviceToolPermissions } from "@/features/users/interfaces/users.interfaces";
import { useBots } from "@/features/bots/hooks/use-bots";
import { getBots } from "@/features/bots/services/bots.services";
import type { BotBrief } from "@/features/bots/interfaces/bots.interfaces";
import { getConversations, openDirect, sendMessage } from "@/features/conversations/services/conversations.services";
import { getAutomations, runAutomationNow } from "@/features/automations/services/automations.services";
import { uploadFile } from "@/features/files/services/files.services";
import { environments } from "@/config/environments";
import { useAuthStore } from "@/stores/auth";
import { useOrganizationStore } from "@/stores/organization";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { platform } from "@/platform";
import { nativeProgress, syncNativeSession } from "@/platform/native";
import { MobileOps, type CalendarCreateArgs, type CalendarListArgs, type ContactsSearchArgs, type ScanArgs, type SendViaAppArgs } from "@/platform/mobile-device-ops";
import { AssistantActions, AssistantParams, VOICE_ON_OPEN_PARAM, onAssistantIntent, type AssistantIntent } from "@/platform/mobile-assistant";
import { onShareReceived, readSharedFile, type SharedItem } from "@/platform/mobile-share";
import { Routes } from "@/routes/routes";

const PromptKinds = { ASK: "ask" } as const;
type Answer = { allow: false } | { allow: true; always?: boolean };
type Prompt = { kind: typeof PromptKinds.ASK; call: DeviceCall };

/** Extra margin so the card closes before the API gives up on the call. */
const PROMPT_MARGIN_MS = 5_000;
const MIN_PROMPT_MS = 5_000;
const VOICE_ON_OPEN_VALUE = "1";
const UPLOAD_PURPOSE_CHAT = "chat" as const;

/** OPEN_APP_FEATURE words → screens ("Hey Google, open approvals in Agent Space"). */
const FEATURE_ROUTES: { words: string[]; path: string }[] = [
  { words: ["approval", "approve"], path: Routes.approvals.root },
  { words: ["task"], path: Routes.tasks.root },
  { words: ["automation", "routine"], path: Routes.automations.root },
  { words: ["bot"], path: Routes.bots.root },
  { words: ["artifact", "document"], path: Routes.artifacts.root },
  { words: ["setting"], path: Routes.settings.root },
  { words: ["chat", "message", "conversation", "ask"], path: Routes.chat.root },
];

const errorMessage = (e: unknown) => (e as Error)?.message || "Failed on the phone";

/**
 * The Android app's native extras (§14.2, §14.3), mounted in the app shell only inside the Android app:
 * - runs the mobile device tools for the bot (same flow as the desktop's DeviceToolsHost: announce on connect,
 *   one call at a time, "Ask each time" card with Allow once / Always allow / Don't allow, then the OS permission);
 * - mirrors the session to the native store (lock-screen approvals, widgets);
 * - handles Google Assistant / widget / shortcut actions and shares from other apps ("Share to a bot").
 */
export const MobileDeviceHost: FC = () => (platform.is("android") ? <MobileDeviceHostInner /> : null);

const MobileDeviceHostInner: FC = () => {
  useNativeSessionSync();
  const prompt = useMobileDeviceTools();
  useAssistantIntents();
  useTaskProgress();
  const [share, setShare] = useState<SharedItem | null>(null);
  useEffect(() => onShareReceived(setShare), []);

  return (
    <>
      <MobilePromptDialog prompt={prompt.current} onAnswer={prompt.answer} />
      {share && <ShareToBotDialog item={share} onClose={() => setShare(null)} />}
    </>
  );
};

/** Keeps the native session store in step with the signed-in session and the selected organisation. */
function useNativeSessionSync() {
  const accessToken = useAuthStore((s) => s.access_token);
  const expiresIn = useAuthStore((s) => s.expires_in);
  const organizationId = useOrganizationStore((s) => s.current_id);
  useEffect(() => {
    if (!accessToken) return;
    void syncNativeSession({ apiUrl: environments.API_URL, organizationId, accessToken, accessExpiresAt: expiresIn ? Math.round(expiresIn * 1000) : null });
  }, [accessToken, expiresIn, organizationId]);
}

const TASK_END_TITLES: Partial<Record<RunStatus, string>> = { [RunStatuses.COMPLETED]: "Finished", [RunStatuses.FAILED]: "Failed", [RunStatuses.STOPPED]: "Stopped" };

/** Long tasks show an ongoing notification with their latest step (§14.2), replaced by a "Finished" note at the end. */
function useTaskProgress() {
  useEffect(() => {
    const tasks = new Map<string, Promise<TaskDetail | null>>();
    const taskOf = (id: string) => {
      if (!tasks.has(id)) tasks.set(id, getTask(id).catch(() => null));
      return tasks.get(id)!;
    };
    return realtime.on((e) => {
      if (e.stream !== RealtimeStreams.USER || e.type !== UserEventTypes.TASK_UPDATED) return;
      const d = e.data as { run_id: string; status: RunStatus; step?: string; steps?: number };
      void taskOf(d.run_id).then((task) => {
        if (!task || task.type !== RunTypes.TASK) return;
        const url = Routes.tasks.detail(task.id);
        const ended = TASK_END_TITLES[d.status];
        if (ended) {
          tasks.delete(d.run_id);
          void nativeProgress.end({ id: task.id, title: `${ended}: ${task.title}`, text: task.bot.name, url });
          return;
        }
        if (![...ACTIVE_RUN_STATUSES, ...WAITING_RUN_STATUSES].includes(d.status)) return;
        const waiting = WAITING_RUN_STATUSES.includes(d.status) ? "Waiting for you" : null;
        const text = waiting ?? (d.step ? `Step ${d.steps ?? ""}: ${d.step}` : `${task.bot.name} is working`);
        void nativeProgress.update({ id: task.id, title: task.title, text, url });
      });
    });
  }, []);
}

function useMobileDeviceTools() {
  const [current, setCurrent] = useState<Prompt | null>(null);
  const answerRef = useRef<((a: Answer) => void) | null>(null);
  const queue = useRef(Promise.resolve());

  const ask = useCallback(
    (p: Prompt) =>
      new Promise<Answer>((resolve) => {
        const timer = setTimeout(() => finish({ allow: false }), Math.max(MIN_PROMPT_MS, p.call.timeout_ms - PROMPT_MARGIN_MS));
        const finish = (a: Answer) => {
          clearTimeout(timer);
          answerRef.current = null;
          setCurrent(null);
          resolve(a);
        };
        answerRef.current = finish;
        setCurrent(p);
      }),
    [],
  );

  // Announce this phone's tools whenever the real-time connection (re)opens. No folders or local tool servers on phones.
  useEffect(
    () =>
      realtime.onDeviceReady(() => {
        void import("@/platform/mobile-tools").then(({ supportedMobileTools }) =>
          realtime.sendDeviceHello({ capabilities: supportedMobileTools(), local_tools: [], allowed_folders: [], blocked_apps: [] }),
        );
      }),
    [],
  );

  const run = useCallback(
    async (call: DeviceCall): Promise<unknown> => {
      if (call.permission === DeviceToolPermissions.NEVER) throw new Error("This tool is turned off on this phone (Settings → Devices).");
      if (call.permission !== DeviceToolPermissions.ALWAYS_ALLOW) {
        const a = await ask({ kind: PromptKinds.ASK, call });
        if (!a.allow) throw new Error("The user didn't allow this on their phone.");
        if (a.always) await setDeviceToolPermission(call.device_id, call.tool, DeviceToolPermissions.ALWAYS_ALLOW).catch(() => undefined);
      }
      const tools = await import("@/platform/mobile-tools");
      const args = call.args ?? {};
      switch (call.op) {
        case MobileOps.SCAN:
          return tools.scan(args as unknown as ScanArgs);
        case MobileOps.CONTACTS_SEARCH:
          return tools.searchContacts(args as unknown as ContactsSearchArgs);
        case MobileOps.SEND_VIA_APP:
          return tools.sendViaApp(args as unknown as SendViaAppArgs);
        case MobileOps.CALENDAR_LIST:
          return tools.listCalendarEvents(args as unknown as CalendarListArgs);
        case MobileOps.CALENDAR_CREATE:
          return tools.createCalendarEvent(args as unknown as CalendarCreateArgs);
        case MobileOps.LOCATION_CURRENT:
          return tools.currentLocation();
        default:
          throw new Error(`This version of the Android app can't do "${call.op}". Update Agent Space.`);
      }
    },
    [ask],
  );

  // One call at a time, so two cards never overlap.
  useEffect(
    () =>
      realtime.onDeviceCall((call) => {
        queue.current = queue.current.then(async () => {
          try {
            realtime.sendDeviceResult({ request_id: call.request_id, ok: true, data: await run(call) });
          } catch (e) {
            realtime.sendDeviceResult({ request_id: call.request_id, ok: false, error: errorMessage(e) });
          }
        });
      }),
    [run],
  );

  return { current, answer: (a: Answer) => answerRef.current?.(a) };
}

/** Finds a bot by its spoken name: an exact (case-insensitive) match first, then the best search hit. */
async function findBot(name: string): Promise<BotBrief | null> {
  const bots = await getBots(name);
  const wanted = name.trim().toLowerCase();
  return bots.find((b) => b.name.toLowerCase() === wanted) ?? bots[0] ?? null;
}

/** "Ask Sales Sam…", "Start voice mode with Sales Sam", "Run my morning briefing", widgets and launcher shortcuts. */
function useAssistantIntents() {
  const navigate = useNavigate();
  const handle = useCallback(
    async ({ action, params }: AssistantIntent) => {
      const botName = params.get(AssistantParams.BOT)?.trim();
      switch (action) {
        case AssistantActions.ASK: {
          if (!botName) return navigate(Routes.chat.root);
          const bot = await findBot(botName);
          if (!bot) {
            toast({ title: `There's no bot called "${botName}"`, variant: "error" });
            return navigate(Routes.chat.root);
          }
          const conversation = await openDirect({ bot_id: bot.id });
          const text = params.get(AssistantParams.TEXT)?.trim();
          if (text) await sendMessage(conversation.id, { content: text, client_id: crypto.randomUUID() });
          return navigate(Routes.chat.conversation(conversation.id));
        }
        case AssistantActions.VOICE: {
          let conversationId: string | null = null;
          if (botName) {
            const bot = await findBot(botName);
            if (bot) conversationId = (await openDirect({ bot_id: bot.id })).id;
            else toast({ title: `There's no bot called "${botName}"`, variant: "error" });
          } else {
            conversationId = (await getConversations())[0]?.id ?? null;
          }
          if (!conversationId) return navigate(Routes.chat.root);
          const qs = new URLSearchParams({ [VOICE_ON_OPEN_PARAM]: VOICE_ON_OPEN_VALUE });
          return navigate(`${Routes.chat.conversation(conversationId)}?${qs}`);
        }
        case AssistantActions.RUN: {
          const name = params.get(AssistantParams.AUTOMATION)?.trim();
          if (!name) return navigate(Routes.automations.root);
          const found = await getAutomations({ search: name });
          const automation = found.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? found[0];
          if (!automation) {
            toast({ title: `There's no automation called "${name}"`, variant: "error" });
            return navigate(Routes.automations.root);
          }
          await runAutomationNow(automation.id);
          toast({ title: `Started "${automation.name}"`, duration: 3000 });
          return navigate(Routes.automations.detail(automation.id));
        }
        case AssistantActions.FEATURE: {
          const feature = (params.get(AssistantParams.FEATURE) ?? "").toLowerCase();
          return navigate(FEATURE_ROUTES.find((f) => f.words.some((w) => feature.includes(w)))?.path ?? Routes.chat.root);
        }
      }
    },
    [navigate],
  );
  useEffect(
    () =>
      onAssistantIntent((intent) => {
        handle(intent).catch((e) => toast({ title: "Couldn't do that", description: errorMessage(e), variant: "error" }));
      }),
    [handle],
  );
}

/** The card shown on this phone for "Ask each time" (§14.3 Permissions). */
const MobilePromptDialog: FC<{ prompt: Prompt | null; onAnswer: (a: Answer) => void }> = ({ prompt, onAnswer }) => {
  if (!prompt) return null;
  const deny = () => onAnswer({ allow: false });
  return (
    <Dialog open onOpenChange={(o) => !o && deny()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> {prompt.call.bot.name} wants to {prompt.call.summary}
          </DialogTitle>
          <DialogDescription>On this phone. You can change this any time in Settings → Devices.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={deny}>Don't allow</Button>
          <Button variant="outline" onClick={() => onAnswer({ allow: true, always: true })}>Always allow</Button>
          <Button onClick={() => onAnswer({ allow: true })}>Allow once</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** "Share to a bot": pick a bot, edit the shared text, send it with the shared files as a new message. */
const ShareToBotDialog: FC<{ item: SharedItem; onClose: () => void }> = ({ item, onClose }) => {
  const navigate = useNavigate();
  const { data: bots, isLoading } = useBots();
  const [botId, setBotId] = useState<string | null>(null);
  const [text, setText] = useState(item.text);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!botId) return;
    setSending(true);
    try {
      const conversation = await openDirect({ bot_id: botId });
      const file_ids: string[] = [];
      for (const f of item.files) {
        const stored = await uploadFile(await readSharedFile(f), UPLOAD_PURPOSE_CHAT, { conversation_id: conversation.id });
        file_ids.push(stored.id);
      }
      await sendMessage(conversation.id, { content: text.trim(), file_ids: file_ids.length ? file_ids : undefined, client_id: crypto.randomUUID() });
      onClose();
      navigate(Routes.chat.conversation(conversation.id));
    } catch (e) {
      toast({ title: "Couldn't share that", description: errorMessage(e), variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 shrink-0" /> Share to a bot</DialogTitle>
          <DialogDescription>Pick who should get this. You can add a note before sending.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[32vh] space-y-1 overflow-y-auto" role="radiogroup" aria-label="Bot">
          {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
          {bots?.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={botId === b.id}
              onClick={() => setBotId(b.id)}
              className={cn("flex w-full items-center gap-3 rounded-md border p-2 text-left", botId === b.id ? "border-primary ring-2 ring-primary" : "border-hairline")}
            >
              <BotAvatar emoji={b.emoji} color={b.color} name={b.name} size={32} />
              <span className="line-clamp-1 text-sm font-semibold text-ink">{b.name}</span>
            </button>
          ))}
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Add a note" />
        {item.files.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {item.files.map((f) => (
              <li key={f.path} className="flex items-center gap-2">
                {f.mimeType.startsWith("image/") ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                <span className="line-clamp-1">{f.name}</span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={() => void send()} disabled={!botId || sending || (!text.trim() && !item.files.length)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
