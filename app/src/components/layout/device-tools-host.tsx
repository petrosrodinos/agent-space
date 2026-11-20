import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Monitor, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { realtime } from "@/features/realtime/services/realtime.services";
import type { DeviceCall } from "@/features/realtime/interfaces/realtime.interfaces";
import { setDeviceToolPermission } from "@/features/users/services/users.services";
import { DeviceToolPermissions } from "@/features/users/interfaces/users.interfaces";
import { getDesktopBridge } from "@/platform/desktop-bridge";
import { ControlStates, type ControlRequest, type DeviceBridge, type DisplayInfo, type ScreenSource } from "@/platform/device-bridge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Control my computer lasts for the task, at most 30 minutes (§14.3). */
const CONTROL_GRANT_MS = 30 * 60_000;
const CallOps = { FILES: "files", SCREEN: "screen", CLIPBOARD_WRITE: "clipboard_write", CLIPBOARD_READ: "clipboard_read", OPEN: "open", LOCAL_TOOL: "local_tool", CONTROL: "control", END_CONTROL: "end_control" } as const;
const PromptKinds = { ASK: "ask", SCREEN: "screen", CONTROL: "control" } as const;

type Answer = { allow: false } | { allow: true; always?: boolean; sourceId?: string; displayId?: string };
type Prompt =
  | { kind: typeof PromptKinds.ASK; call: DeviceCall }
  | { kind: typeof PromptKinds.SCREEN; call: DeviceCall; sources: ScreenSource[] }
  | { kind: typeof PromptKinds.CONTROL; call: DeviceCall; displays: DisplayInfo[] };

/** Electron prefixes errors from the main process with "Error invoking remote method 'device:x': Error: ". */
const cleanError = (e: unknown) => ((e as Error)?.message || "Failed on the computer").replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "");

/** Re-announces this computer (capabilities, local tools, folders) after its settings change. */
let announce: (() => Promise<void>) | null = null;
export const refreshDeviceAnnouncement = () => announce?.();

/**
 * Runs device tools on this computer (§14.3), in the desktop app only. Calls arrive on the real-time connection; the
 * user answers "Ask each time" cards, the screen picker and the "control this computer" card here, in the app, and
 * the main process carries the call out and checks it again (allowed folders, blocked apps, the control grant).
 */
export const DeviceToolsHost: FC = () => {
  const bridge = getDesktopBridge()?.device ?? null;
  return bridge ? <DeviceToolsHostInner device={bridge} /> : null;
};

const DeviceToolsHostInner: FC<{ device: DeviceBridge }> = ({ device }) => {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const answerRef = useRef<((a: Answer) => void) | null>(null);
  const grants = useRef(new Map<string, { grantId: string; expiresAt: number }>()); // run id → control grant
  const queue = useRef(Promise.resolve());

  const ask = useCallback(
    (p: Prompt) =>
      new Promise<Answer>((resolve) => {
        const timer = setTimeout(() => finish({ allow: false }), Math.max(5_000, p.call.timeout_ms - 5_000));
        const finish = (a: Answer) => {
          clearTimeout(timer);
          answerRef.current = null;
          setPrompt(null);
          resolve(a);
        };
        answerRef.current = finish;
        setPrompt(p);
      }),
    [],
  );
  const answer = (a: Answer) => answerRef.current?.(a);

  // Announce this computer whenever the connection (re)opens.
  useEffect(() => {
    announce = async () => {
      const [capabilities, local_tools, allowed_folders, blocked] = await Promise.all([
        device.capabilities().catch(() => []),
        device.listLocalTools().catch(() => []),
        device.listFolders().catch(() => []),
        device.getBlockedApps().catch(() => ({ builtIn: [], extra: [] })),
      ]);
      realtime.sendDeviceHello({ capabilities, local_tools, allowed_folders, blocked_apps: blocked.extra });
    };
    const off = realtime.onDeviceReady(() => void announce?.());
    return () => {
      off();
      announce = null;
    };
  }, [device]);

  // When the user pauses or stops control from the bar or the shortcut, forget the grant.
  useEffect(
    () =>
      device.onControlEvent((e) => {
        if (e.state === ControlStates.STOPPED || e.state === ControlStates.EXPIRED) {
          for (const [run, g] of grants.current) if (g.grantId === e.grantId) grants.current.delete(run);
          toast({ title: e.state === ControlStates.EXPIRED ? "Control of this computer ended (time limit)" : "You stopped the bot controlling this computer", duration: 3000 });
        }
      }),
    [device],
  );

  const run = useCallback(
    async (call: DeviceCall): Promise<unknown> => {
      const allowed = async () => {
        if (call.permission === DeviceToolPermissions.ALWAYS_ALLOW) return true;
        const a = await ask({ kind: PromptKinds.ASK, call });
        if (a.allow && a.always) await setDeviceToolPermission(call.device_id, call.tool, DeviceToolPermissions.ALWAYS_ALLOW).catch(() => undefined);
        return a.allow;
      };
      const refuse = () => {
        throw new Error("The user didn't allow this on their computer.");
      };
      const args = call.args ?? {};
      switch (call.op) {
        case CallOps.FILES:
          if (!(await allowed())) refuse();
          return device.files(args as unknown as Parameters<DeviceBridge["files"]>[0]);
        case CallOps.CLIPBOARD_WRITE:
          if (!(await allowed())) refuse();
          await getDesktopBridge()!.clipboardWrite(String(args.text ?? ""));
          return { ok: true };
        case CallOps.CLIPBOARD_READ:
          if (!(await allowed())) refuse();
          return { text: (await getDesktopBridge()!.clipboardRead()).slice(0, 100_000) };
        case CallOps.OPEN:
          if (!(await allowed())) refuse();
          return device.open({ kind: args.kind as "url" | "path" | "app", target: String(args.target ?? "") });
        case CallOps.LOCAL_TOOL:
          if (!(await allowed())) refuse();
          return device.callLocalTool(String(args.server_id), String(args.tool), (args.args as Record<string, unknown>) ?? {});
        case CallOps.SCREEN: {
          // The picker is the permission prompt: nothing is captured until the user picks.
          const sources = await device.screenSources();
          const a = await ask({ kind: PromptKinds.SCREEN, call, sources });
          if (!a.allow || !a.sourceId) return { cancelled: true };
          const image = await device.captureSource(a.sourceId);
          return { name: sources.find((s) => s.id === a.sourceId)?.name ?? "Screen", image };
        }
        case CallOps.CONTROL: {
          let grant = grants.current.get(call.run_id);
          if (grant && grant.expiresAt < Date.now()) {
            grants.current.delete(call.run_id);
            grant = undefined;
          }
          if (!grant) {
            const displays = await device.displays();
            const a = await ask({ kind: PromptKinds.CONTROL, call, displays });
            if (!a.allow) return { denied: true };
            grant = { grantId: crypto.randomUUID(), expiresAt: Date.now() + CONTROL_GRANT_MS };
            await device.beginControl({ grantId: grant.grantId, displayId: a.displayId ?? displays.find((d) => d.primary)?.id ?? displays[0]?.id ?? "", botName: call.bot.name, task: String(args.task ?? ""), expiresAt: grant.expiresAt });
            grants.current.set(call.run_id, grant);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { task, ...req } = args;
          return device.control(grant.grantId, req as unknown as ControlRequest);
        }
        default:
          throw new Error(`This version of the desktop app can't do "${call.op}". Update Agent Space.`);
      }
    },
    [ask, device],
  );

  // Calls are handled one at a time, so two prompts never overlap.
  useEffect(
    () =>
      realtime.onDeviceCall((call) => {
        if (call.op === CallOps.END_CONTROL) {
          const g = grants.current.get(call.run_id);
          if (g) {
            grants.current.delete(call.run_id);
            void device.endControl(g.grantId).catch(() => undefined);
          }
          return;
        }
        queue.current = queue.current.then(async () => {
          try {
            realtime.sendDeviceResult({ request_id: call.request_id, ok: true, data: await run(call) });
          } catch (e) {
            realtime.sendDeviceResult({ request_id: call.request_id, ok: false, error: cleanError(e) });
          }
        });
      }),
    [device, run],
  );

  return <DevicePromptDialog prompt={prompt} onAnswer={answer} />;
};

/** The cards shown on this computer: "Ask each time", the screen picker and the control card (§14.3). */
const DevicePromptDialog: FC<{ prompt: Prompt | null; onAnswer: (a: Answer) => void }> = ({ prompt, onAnswer }) => {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    setChoice(prompt?.kind === PromptKinds.CONTROL ? (prompt.displays.find((d) => d.primary)?.id ?? prompt.displays[0]?.id ?? null) : null);
  }, [prompt]);
  if (!prompt) return null;
  const bot = prompt.call.bot.name;
  const deny = () => onAnswer({ allow: false });

  return (
    <Dialog open onOpenChange={(o) => !o && deny()}>
      <DialogContent className="sm:max-w-lg">
        {prompt.kind === PromptKinds.ASK && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> {bot} wants to {prompt.call.summary}</DialogTitle>
              <DialogDescription>On this computer. You can change this any time in Settings → Devices.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={deny}>Don't allow</Button>
              <Button variant="outline" onClick={() => onAnswer({ allow: true, always: true })}>Always allow</Button>
              <Button onClick={() => onAnswer({ allow: true })}>Allow once</Button>
            </DialogFooter>
          </>
        )}
        {prompt.kind === PromptKinds.SCREEN && (
          <>
            <DialogHeader>
              <DialogTitle>{bot} wants to look at your screen</DialogTitle>
              <DialogDescription>{String(prompt.call.args.reason ?? "")} Pick a window or screen to share once, or cancel.</DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {prompt.sources.map((s) => (
                <button key={s.id} type="button" onClick={() => setChoice(s.id)} className={cn("rounded-md border p-1.5 text-left text-xs", choice === s.id ? "border-primary ring-2 ring-primary" : "border-hairline")}>
                  <img src={s.thumbnail} alt="" className="mb-1 aspect-video w-full rounded object-cover" />
                  <span className="line-clamp-1 font-semibold text-ink">{s.name}</span>
                </button>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={deny}>Cancel</Button>
              <Button disabled={!choice} onClick={() => choice && onAnswer({ allow: true, sourceId: choice })}>Share this</Button>
            </DialogFooter>
          </>
        )}
        {prompt.kind === PromptKinds.CONTROL && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /> {bot} wants to control this computer</DialogTitle>
              <DialogDescription>
                To: {String(prompt.call.args.task ?? "help with what you asked")}. It can use the apps on the screen you pick, until the task ends or for 30 minutes. Move the mouse or type to take over; press Ctrl/Cmd+Alt+Shift+S to stop.
              </DialogDescription>
            </DialogHeader>
            {prompt.displays.length > 1 && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Screen">
                {prompt.displays.map((d) => (
                  <Button key={d.id} variant={choice === d.id ? "default" : "outline"} size="sm" role="radio" aria-checked={choice === d.id} onClick={() => setChoice(d.id)}>
                    {d.label} ({d.width}×{d.height})
                  </Button>
                ))}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={deny}>Don't allow</Button>
              <Button onClick={() => onAnswer({ allow: true, displayId: choice ?? undefined })}>Allow</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

