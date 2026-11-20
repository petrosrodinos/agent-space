import { useCallback, useEffect, useState, type FC } from "react";
import { App } from "@capacitor/app";
import { Download, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { environments } from "@/config/environments";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";

/** Written by app/scripts/release-android.mjs and served by the API (api/src/modules/android-releases). */
const RELEASES_URL = `${environments.API_URL}/android/releases`;
const LATEST_MANIFEST_URL = `${RELEASES_URL}/latest.json`;
const LATEST_APK_URL = `${RELEASES_URL}/download/AgentSpace.apk`;

interface AndroidLatestRelease {
  version: string;
  versionCode: number;
  download: string;
  notes?: string;
}

async function fetchLatestRelease(): Promise<AndroidLatestRelease | null> {
  const res = await fetch(LATEST_MANIFEST_URL, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as AndroidLatestRelease | null;
}

/** Web only: links to the Android APK. */
const AndroidDownloadRow: FC = () => (
  <SettingsCard title="Android app" description="Get Agent Space on your phone, with push notifications, voice mode and lock-screen approvals.">
    <SettingRow label="Download" description="Downloads the latest APK. You may need to allow installing apps from your browser once.">
      <Button asChild variant="outline">
        <a href={LATEST_APK_URL} download>
          <Smartphone className="h-4 w-4" />
          Android (APK)
        </a>
      </Button>
    </SettingRow>
  </SettingsCard>
);

/** Android app only: the installed version and a manual check for a newer APK. */
const AndroidUpdateRow: FC = () => {
  const [installed, setInstalled] = useState<{ version: string; code: number } | null>(null);
  const [latest, setLatest] = useState<AndroidLatestRelease | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (manual: boolean) => {
    setChecking(true);
    const release = await fetchLatestRelease().finally(() => setChecking(false));
    setLatest(release);
    if (!manual) return;
    if (!release) toast({ title: "Couldn't check for updates", variant: "error" });
    else toast({ title: "You have the latest version", duration: 1800 });
  }, []);

  useEffect(() => {
    void App.getInfo().then((info) => setInstalled({ version: info.version, code: Number(info.build) }));
    void check(false);
  }, [check]);

  const hasUpdate = !!latest && !!installed && latest.versionCode > installed.code;
  return (
    <SettingsCard title="This phone" description={`Agent Space ${installed?.version ?? platform.appInfo.version} for Android`}>
      <SettingRow
        label="Updates"
        description={hasUpdate ? `Version ${latest.version} is available.${latest.notes ? ` ${latest.notes}` : ""}` : "You have the latest version."}
      >
        {hasUpdate ? (
          <Button onClick={() => platform.links.openExternal(latest.download)}>
            <Download /> Download update
          </Button>
        ) : (
          <Button variant="outline" loading={checking} onClick={() => void check(true)}>
            <RefreshCw /> Check now
          </Button>
        )}
      </SettingRow>
    </SettingsCard>
  );
};

/** Settings → Devices (§14.2): the APK download on the web, the update check inside the Android app, nothing on desktop. */
export const AndroidAppCard: FC = () => {
  if (platform.is("web")) return <AndroidDownloadRow />;
  if (platform.is("android")) return <AndroidUpdateRow />;
  return null;
};
