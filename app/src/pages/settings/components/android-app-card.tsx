import { useCallback, useEffect, useState, type FC } from "react";
import { App } from "@capacitor/app";
import { Download, Globe, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { InstallTargets, platform, pwa } from "@/platform";
import { DESKTOP_MAC_INSTALLER_URL, DESKTOP_WINDOWS_INSTALLER_URL, DesktopOses, detectDesktopOs } from "@/platform/desktop-release";
import { ANDROID_LATEST_APK_URL, ANDROID_LATEST_MANIFEST_URL } from "@/platform/android-release";
import { useInstallApp } from "@/hooks/use-install-app";
import { toast } from "@/hooks/use-toast";

interface AndroidLatestRelease {
  version: string;
  versionCode: number;
  download: string;
  notes?: string;
}

async function fetchLatestRelease(): Promise<AndroidLatestRelease | null> {
  const res = await fetch(ANDROID_LATEST_MANIFEST_URL, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as AndroidLatestRelease | null;
}

/** Web only: the two ways to get the app, the Android APK or the installable web app (PWA). */
const AppDownloadRows: FC = () => {
  const installApp = useInstallApp();
  const target = pwa.target();
  const mobile = target === InstallTargets.IOS || target === InstallTargets.ANDROID;
  const desktopOs = detectDesktopOs();
  const showApk = target === InstallTargets.ANDROID || !mobile;
  const showDesktop = !mobile;
  return (
    <SettingsCard title="Get the app" description="Use Agent Space on your phone with push notifications, voice mode and lock-screen approvals.">
      {showApk && (
        <SettingRow label="Android app (APK)" description="Downloads the latest APK. You may need to allow installing apps from your browser once.">
          <Button asChild variant="outline">
            <a href={ANDROID_LATEST_APK_URL} download>
              <Smartphone className="h-4 w-4" />
              Download APK
            </a>
          </Button>
        </SettingRow>
      )}
      {showDesktop && (
        <SettingRow
          label={desktopOs === DesktopOses.MAC ? "Mac app" : "Windows app"}
          description={desktopOs === DesktopOses.MAC ? "Downloads the desktop app for macOS." : "Downloads the desktop app installer for Windows, with updates built in."}
        >
          <Button asChild variant="outline">
            <a href={desktopOs === DesktopOses.MAC ? DESKTOP_MAC_INSTALLER_URL : DESKTOP_WINDOWS_INSTALLER_URL} download>
              <Monitor className="h-4 w-4" />
              Download for {desktopOs === DesktopOses.MAC ? "Mac" : "Windows"}
            </a>
          </Button>
        </SettingRow>
      )}
      {installApp.available && (
        <SettingRow label="Web app (PWA)" description="Adds Agent Space to your home screen or dock from this browser. No download needed.">
          <Button variant="outline" onClick={() => void installApp.installPwa()}>
            <Globe className="h-4 w-4" />
            Install web app
          </Button>
        </SettingRow>
      )}
    </SettingsCard>
  );
};

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
  if (platform.is("web")) return <AppDownloadRows />;
  if (platform.is("android")) return <AndroidUpdateRow />;
  return null;
};
