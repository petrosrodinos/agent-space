import { useCallback, useEffect, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { realtime } from "@/features/realtime/services/realtime.services";
import { useDeviceTools, useSetDeviceTool } from "@/features/users/hooks/use-users";
import type { DeviceToolPermission } from "@/features/users/interfaces/users.interfaces";
import { ControlComputerPermissionFormOptions, DesktopToolOptions, DeviceToolPermissionFormOptions } from "@/config/constants/dropdowns/users/device-tool-form.options";
import { getDesktopBridge } from "@/platform/desktop-bridge";
import { DesktopToolKinds, type DeviceBridge, type LocalToolServerConfig } from "@/platform/device-bridge";
import { refreshDeviceAnnouncement } from "@/components/layout/device-tools-host";
import { toast } from "@/hooks/use-toast";
import { localToolServerSchema, type LocalToolServerFormValues } from "../validation-schemas/local-tool-server.schema";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { SelectSetting } from "./setting-controls";

const run = async <T,>(fn: () => Promise<T>, fail: string): Promise<T | null> => {
  try {
    const r = await fn();
    void refreshDeviceAnnouncement();
    return r;
  } catch (e) {
    toast({ title: fail, description: ((e as Error).message || "").replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, ""), variant: "error" });
    return null;
  }
};

/** §13.2 Devices / §14.3: what bots may do on this computer. Only shown inside the desktop app. */
export const DeviceToolsCard: FC = () => {
  const device = getDesktopBridge()?.device ?? null;
  const [deviceId, setDeviceId] = useState<string | null>(realtime.deviceId);
  useEffect(() => realtime.onDeviceReady(setDeviceId), []);
  if (!device) return null;
  return <DeviceToolsCardInner device={device} deviceId={deviceId} />;
};

const DeviceToolsCardInner: FC<{ device: DeviceBridge; deviceId: string | null }> = ({ device, deviceId }) => {
  const { data: settings } = useDeviceTools(deviceId);
  const setTool = useSetDeviceTool();
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [servers, setServers] = useState<LocalToolServerConfig[]>([]);
  const [blocked, setBlocked] = useState<{ builtIn: string[]; extra: string[] }>({ builtIn: [], extra: [] });
  const [extraApps, setExtraApps] = useState("");
  const [editing, setEditing] = useState<LocalToolServerConfig | "new" | null>(null);
  const [removing, setRemoving] = useState<LocalToolServerConfig | null>(null);

  const load = useCallback(async () => {
    const [c, f, s, b] = await Promise.all([device.capabilities(), device.listFolders(), device.listToolServers(), device.getBlockedApps()]);
    setCapabilities(c);
    setFolders(f);
    setServers(s);
    setBlocked(b);
    setExtraApps(b.extra.join("\n"));
  }, [device]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const tools = DesktopToolOptions.filter((t) => !capabilities.length || capabilities.includes(t.id));

  return (
    <SettingsCard title="This computer" description="What bots may do on this computer. Each use shows on the bot's activity and in the activity history.">
      {deviceId && settings ? (
        tools.map((t) => (
          <SelectSetting
            key={t.id}
            label={t.label}
            description={t.description}
            value={settings.permissions[t.id]}
            options={t.id === DesktopToolKinds.CONTROL_COMPUTER ? ControlComputerPermissionFormOptions : DeviceToolPermissionFormOptions}
            onChange={(v) => setTool.mutate({ id: deviceId, tool: t.id, permission: v as DeviceToolPermission }, { onSuccess: () => void refreshDeviceAnnouncement() })}
          />
        ))
      ) : (
        <p className="py-3 text-sm text-muted-foreground">Connecting this computer…</p>
      )}

      <SettingRow label="Allowed folders" description="Bots can only see files inside these folders. There are none until you add one.">
        <Button variant="outline" size="sm" onClick={() => void run(async () => setFolders(await device.addFolder()), "Could not add the folder")}>
          <FolderPlus /> Add folder
        </Button>
      </SettingRow>
      {!!folders.length && (
        <ul className="mb-2 space-y-1.5">
          {folders.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={f}>{f}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${f}`} onClick={() => void run(async () => setFolders(await device.removeFolder(f)), "Could not remove the folder")}>
                <Trash2 className="!h-3.5 !w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SettingRow label="Local tool servers" description="Tool servers (MCP) on this computer or your company network. Private to this computer.">
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add
        </Button>
      </SettingRow>
      {!!servers.length && (
        <ul className="mb-2 space-y-1.5">
          {servers.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{[s.command, ...s.args].join(" ")}</p>
              </div>
              <Switch checked={s.enabled} aria-label={`Use ${s.name}`} onCheckedChange={(enabled) => void run(async () => setServers(await device.saveToolServer({ id: s.id, name: s.name, command: s.command, args: s.args, enabled })), "Could not save")} />
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil className="!h-3.5 !w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${s.name}`} onClick={() => setRemoving(s)}><Trash2 className="!h-3.5 !w-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}

      <SettingRow label="Apps bots can't use" description={`Always off-limits: ${blocked.builtIn.slice(0, 6).join(", ")}${blocked.builtIn.length > 6 ? "…" : ""}. Add more, one per line.`}>
        <div className="flex w-full flex-col gap-2 sm:w-[260px]">
          <Textarea rows={3} value={extraApps} onChange={(e) => setExtraApps(e.target.value)} aria-label="Apps bots can't use" placeholder="e.g. Banking app" />
          <Button variant="outline" size="sm" disabled={extraApps === blocked.extra.join("\n")} onClick={() => void run(async () => setBlocked(await device.setBlockedApps(extraApps.split("\n").map((l) => l.trim()).filter(Boolean))), "Could not save")}>
            Save apps
          </Button>
        </div>
      </SettingRow>

      <LocalToolServerDialog device={device} server={editing} onClose={() => setEditing(null)} onSaved={setServers} />
      <ConfirmationDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove "${removing?.name}"?`}
        description="Bots stop using its tools on this computer."
        confirmText="Remove"
        variant="destructive"
        onConfirm={() => removing && void run(async () => setServers(await device.removeToolServer(removing.id)), "Could not remove").then(() => setRemoving(null))}
      />
    </SettingsCard>
  );
};

const LocalToolServerDialog: FC<{ device: DeviceBridge; server: LocalToolServerConfig | "new" | null; onClose: () => void; onSaved: (s: LocalToolServerConfig[]) => void }> = ({ device, server, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const form = useForm<LocalToolServerFormValues>({ resolver: zodResolver(localToolServerSchema), defaultValues: { name: "", command: "", args: "", env: "", enabled: true } });
  useEffect(() => {
    if (server === "new") form.reset({ name: "", command: "", args: "", env: "", enabled: true });
    else if (server) form.reset({ name: server.name, command: server.command, args: server.args.join("\n"), env: server.envKeys.map((k) => `${k}=`).join("\n"), enabled: server.enabled });
  }, [server, form]);

  const save = async (v: LocalToolServerFormValues) => {
    setSaving(true);
    // Keys left as "NAME=" keep their stored value; the values themselves never come back to the page.
    const env = Object.fromEntries(v.env.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]).filter(([, val]) => val !== ""));
    const res = await run(() => device.saveToolServer({ id: server && server !== "new" ? server.id : undefined, name: v.name, command: v.command, args: v.args.split("\n").map((a) => a.trim()).filter(Boolean), env, enabled: v.enabled }), "Could not save the tool server");
    setSaving(false);
    if (res) {
      onSaved(res);
      onClose();
    }
  };

  return (
    <Dialog open={!!server} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{server === "new" ? "Add a local tool server" : "Edit tool server"}</DialogTitle>
          <DialogDescription>It runs on this computer when a bot needs it. Its tools appear next to your other tools, labelled with this computer.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="local-tool-server" className="space-y-3" onSubmit={form.handleSubmit(save)}>
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Company database" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="command" render={({ field }) => (<FormItem><FormLabel>Command</FormLabel><FormControl><Input placeholder="npx" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="args" render={({ field }) => (<FormItem><FormLabel>Arguments (one per line)</FormLabel><FormControl><Textarea rows={3} className="font-mono" placeholder={"-y\n@modelcontextprotocol/server-postgres\npostgresql://localhost/db"} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="env" render={({ field }) => (<FormItem><FormLabel>Environment variables (NAME=value, one per line; leave the value empty to keep the saved one)</FormLabel><FormControl><Textarea rows={2} className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="enabled" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel>Use it</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="local-tool-server" loading={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
