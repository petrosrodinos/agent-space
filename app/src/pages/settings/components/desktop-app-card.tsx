import { useEffect, useState, type FC } from "react";
import { RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { platform, DesktopUpdateStatus, type DesktopUpdateState } from "@/platform";
import { useDesktopUpdateState } from "@/hooks/use-desktop-updates";
import { toast } from "@/hooks/use-toast";

function updateDescription(u: DesktopUpdateState | null): string {
  switch (u?.status) {
    case DesktopUpdateStatus.disabled:
      return "Automatic updates aren't set up for this build.";
    case DesktopUpdateStatus.checking:
      return "Checking for updates…";
    case DesktopUpdateStatus.available:
    case DesktopUpdateStatus.downloading:
      return `Downloading version ${u.version ?? ""}${u.percent != null ? ` (${u.percent}%)` : ""}…`;
    case DesktopUpdateStatus.downloaded:
      return `Version ${u.version} is ready. It installs when you restart the app.`;
    case DesktopUpdateStatus.error:
      return "The last update check failed. Agent Space tries again in a few hours.";
    default:
      return "Agent Space checks for updates in the background and installs them when you restart.";
  }
}

/** Desktop app only (§14.2): launch at start-up, the global quick-ask shortcut and updates. */
export const DesktopAppCard: FC = () => {
  const desktop = platform.desktop;
  const [startup, setStartup] = useState<boolean | null>(null);
  const [shortcut, setShortcut] = useState("");
  const [saved, setSaved] = useState("");
  const [checking, setChecking] = useState(false);
  const update = useDesktopUpdateState();

  useEffect(() => {
    if (!desktop) return;
    void desktop.getLaunchAtStartup().then(setStartup);
    void desktop.getQuickAskShortcut().then((s) => {
      setShortcut(s);
      setSaved(s);
    });
  }, [desktop]);

  if (!desktop) return null;
  return (
    <SettingsCard title="This computer" description={`Agent Space ${platform.appInfo.version} for desktop`}>
      <SettingRow label="Open at start-up" description="Start Agent Space when you sign in to your computer, so notifications reach you.">
        <Switch
          checked={!!startup}
          disabled={startup === null}
          onCheckedChange={(v) => {
            setStartup(v);
            void desktop.setLaunchAtStartup(v);
          }}
          aria-label="Open at start-up"
        />
      </SettingRow>
      <SettingRow label="Quick-ask shortcut" description="Opens Agent Space on a new chat from anywhere. Example: CommandOrControl+Shift+Space.">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await desktop.setQuickAskShortcut(shortcut.trim());
            if (ok) setSaved(shortcut.trim());
            toast(ok ? { title: "Shortcut saved", duration: 1800 } : { title: "That shortcut is taken or not valid", variant: "error" });
          }}
        >
          <Input className="w-[230px]" value={shortcut} onChange={(e) => setShortcut(e.target.value)} aria-label="Quick-ask shortcut" />
          <Button type="submit" variant="outline" disabled={!shortcut.trim() || shortcut.trim() === saved}>
            Save
          </Button>
        </form>
      </SettingRow>
      <SettingRow label="Updates" description={updateDescription(update)}>
        {update?.status === DesktopUpdateStatus.downloaded ? (
          <Button onClick={() => void desktop.installUpdate()}>
            <RotateCw /> Restart to update
          </Button>
        ) : (
          <Button
            variant="outline"
            loading={checking}
            disabled={update?.status === DesktopUpdateStatus.disabled || update?.status === DesktopUpdateStatus.downloading}
            onClick={async () => {
              setChecking(true);
              const r = await desktop.checkForUpdates().finally(() => setChecking(false));
              if (r.status === DesktopUpdateStatus.none) toast({ title: "You have the latest version", duration: 1800 });
              if (r.status === DesktopUpdateStatus.error) toast({ title: "Couldn't check for updates", description: r.message, variant: "error" });
            }}
          >
            <RefreshCw /> Check now
          </Button>
        )}
      </SettingRow>
    </SettingsCard>
  );
};
