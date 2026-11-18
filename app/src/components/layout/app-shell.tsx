import { useEffect, type FC } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { useMe } from "@/features/users/hooks/use-users";
import { heartbeat, getVersionPolicy } from "@/features/users/services/users.services";
import { useRealtimeConnection, useRealtimeStatus } from "@/features/realtime/hooks/use-realtime";
import { useOrganizationStore } from "@/stores/organization";
import { useUiStore } from "@/stores/ui";
import { useAppearance } from "@/hooks/use-theme";
import { toast } from "@/hooks/use-toast";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { SplashSkeleton } from "./session-gate";
import { ToastAction } from "@/components/ui/toast";
import { QueryKeys } from "@/config/constants/query-keys";
import { NewChatDialog } from "./new-chat/new-chat-dialog";
import { ShortcutKeys } from "@/config/constants/browser.constants";

const isOlder = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
};

/** Signed-in bootstrap: selected org, appearance, realtime, device heartbeat, version check, keyboard shortcuts. */
function useShellBootstrap() {
  const { data: me } = useMe();
  const currentOrg = useOrganizationStore((s) => s.current_id);
  const setOrg = useOrganizationStore((s) => s.setCurrent);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  const colorTheme = me?.organizations.find((o) => o.id === currentOrg)?.color_theme;
  useAppearance(me?.settings.theme, me?.settings.text_size, me?.settings.layout_density, colorTheme);
  useRealtimeConnection();

  useEffect(() => {
    if (!me) return;
    if (!currentOrg || !me.organizations.some((o) => o.id === currentOrg)) setOrg(me.organizations[0]?.id ?? null);
  }, [me, currentOrg, setOrg]);

  useEffect(() => {
    void heartbeat({ app_version: platform.appInfo.version, capabilities: ([QueryKeys.NOTIFICATIONS, "voice", "share", "clipboard"] as const).filter((c) => platform.supports(c)) }).catch(() => undefined);
    // §14.1 version check: "Reload to update".
    void getVersionPolicy()
      .then((p) => {
        if (isOlder(platform.appInfo.version, p.minimum_version))
          toast({
            title: "A new version is available",
            description: "Reload to update Agent Space.",
            duration: 60_000,
            action: (
              <ToastAction altText="Reload" onClick={() => platform.links.redirect(window.location.href)}>
                Reload
              </ToastAction>
            ),
          });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === ShortcutKeys.COMMAND_PALETTE) {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (mod && e.altKey && e.key.toLowerCase() === ShortcutKeys.NEW_CHAT) {
        e.preventDefault();
        navigate(Routes.chat.root);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, setCommandOpen]);

  return { ready: !!me && !!currentOrg };
}

/**
 * Responsive shell (DESIGN.MD): ≥1200px full sidebar; 768–1199px a 72px rail; <768px one screen at a time (Grok-style):
 * Chats is home; every other screen puts a round back button on its own title row (PageHeader / MobileTopBar).
 */
const AppShell: FC = () => {
  const { ready } = useShellBootstrap();
  const connected = useRealtimeStatus();
  const location = useLocation();

  if (!ready) return <SplashSkeleton />;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      {/* Desktop */}
      <div className="hidden desk:flex">
        <AppSidebar className="border-r border-hairline" />
      </div>
      {/* Tablet rail */}
      <div className="hidden md:flex desk:hidden">
        <AppSidebar collapsed className="border-r border-hairline" />
      </div>

      <main className="scrollbar-thin relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" key={location.pathname.split("/")[1]}>
        {!connected && (
          <div className="flex items-center justify-center gap-2 bg-warning-soft px-3 py-1 text-xs font-semibold text-warning" role="status">
            <WifiOff className="h-3.5 w-3.5" /> Reconnecting… live updates will resume automatically
          </div>
        )}
        <Outlet />
      </main>

      <CommandPalette />
      <NewChatDialog />
    </div>
  );
};

export default AppShell;
