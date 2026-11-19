import type { FC } from "react";
import { Laptop, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { environments } from "@/config/environments";
import { platform } from "@/platform";

/** Stable "latest" installer links served by the API (desktop/scripts/release.mjs uploads them). */
const DESKTOP_DOWNLOADS = {
  windows: `${environments.API_URL}/desktop/releases/download/AgentSpace-Setup.exe`,
  mac: `${environments.API_URL}/desktop/releases/download/AgentSpace.dmg`,
} as const;

/** Web only (§14.2): links to the desktop app installers. Hidden inside the desktop and mobile apps. */
export const DesktopDownloadCard: FC = () => {
  if (!platform.is("web")) return null;
  return (
    <SettingsCard title="Desktop app" description="Get Agent Space for your computer, with notifications and a quick-ask shortcut.">
      <SettingRow label="Download" description="Installs the latest version. It keeps itself up to date.">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={DESKTOP_DOWNLOADS.windows} download>
              <Monitor className="h-4 w-4" />
              Windows
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={DESKTOP_DOWNLOADS.mac} download>
              <Laptop className="h-4 w-4" />
              Mac
            </a>
          </Button>
        </div>
      </SettingRow>
    </SettingsCard>
  );
};
