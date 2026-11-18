import { useEffect, useState, type FC } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";

/** Desktop app only (§14.2): launch at start-up, the global quick-ask shortcut and updates. */
export const DesktopAppCard: FC = () => {
  const desktop = platform.desktop;
  const [startup, setStartup] = useState<boolean | null>(null);
  const [shortcut, setShortcut] = useState("");
  const [saved, setSaved] = useState("");
  const [checking, setChecking] = useState(false);

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
      <SettingRow label="Updates" description="Updates install automatically when you restart the app.">
        <Button
          variant="outline"
          loading={checking}
          onClick={async () => {
            setChecking(true);
            const r = await desktop.checkForUpdates().finally(() => setChecking(false));
            const title = { disabled: "Automatic updates aren't set up for this build", none: "You have the latest version", available: `Version ${r.version} is downloading`, downloaded: "Restart to finish updating", error: "Couldn't check for updates" }[r.status];
            toast({ title, description: r.message, variant: r.status === "error" ? "error" : undefined });
          }}
        >
          <RefreshCw /> Check now
        </Button>
      </SettingRow>
    </SettingsCard>
  );
};
