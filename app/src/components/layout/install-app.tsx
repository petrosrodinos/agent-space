import type { FC, ReactNode } from "react";
import { BellRing, Download, EllipsisVertical, Share, SquarePlus, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInstallApp } from "@/hooks/use-install-app";
import { InstallTargets, IosBrowsers, type InstallTarget, type IosBrowser } from "@/platform";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

const APP_ICON_SRC = "/apple-touch-icon.png";

const AppIcon: FC<{ className?: string }> = ({ className }) => <img src={APP_ICON_SRC} alt="" className={cn("h-11 w-11 shrink-0 rounded-[12px] border border-hairline", className)} />;

type Step = { icon: LucideIcon; text: ReactNode };

/** Labels as the browser shows them, so the user can find the right button. */
const Strong: FC<{ children: ReactNode }> = ({ children }) => <span className="font-bold text-ink">{children}</span>;

function installSteps(target: InstallTarget, iosBrowser: IosBrowser): Step[] {
  if (target === InstallTargets.IOS)
    return [
      {
        icon: Share,
        text:
          iosBrowser === IosBrowsers.SAFARI ? (
            <>
              Tap <Strong>Share</Strong> in Safari's toolbar (at the bottom on iPhone, top right on iPad).
            </>
          ) : (
            <>
              Tap <Strong>Share</Strong> in the address bar. If you don't see "Add to Home Screen" in the next step, open this page in Safari.
            </>
          ),
      },
      {
        icon: SquarePlus,
        text: (
          <>
            Scroll down and tap <Strong>Add to Home Screen</Strong>.
          </>
        ),
      },
      {
        icon: Download,
        text: (
          <>
            Tap <Strong>Add</Strong>, then open Agent Space from your Home Screen.
          </>
        ),
      },
    ];
  return [
    {
      icon: EllipsisVertical,
      text: (
        <>
          Tap the browser menu <Strong>(three dots)</Strong> at the top right.
        </>
      ),
    },
    {
      icon: SquarePlus,
      text: (
        <>
          Tap <Strong>Install app</Strong> or <Strong>Add to Home screen</Strong>.
        </>
      ),
    },
    {
      icon: Download,
      text: (
        <>
          Confirm with <Strong>Install</Strong>, then open Agent Space from your home screen.
        </>
      ),
    },
  ];
}

/** Mobile web banner on Chats: offers to install Agent Space to the home screen. */
export const InstallAppBanner: FC<{ className?: string }> = ({ className }) => {
  const { showBanner, target, canPrompt, install, installsNative, isDesktop, dismissBanner } = useInstallApp();
  if (!showBanner) return null;

  return (
    <div className={cn("mx-3 mb-2 flex items-center gap-3 rounded-lg border border-hairline bg-surface p-3 shadow-sticker", className)} role="region" aria-label="Install the app">
      <AppIcon />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-ink">Get the Agent Space app</p>
        <p className="text-xs text-muted-foreground">{target === InstallTargets.IOS ? "Add it to your Home Screen for full-screen chats and notifications." : installsNative ? (isDesktop ? "Download the desktop app for notifications, voice mode and computer control." : "Download the Android app for push notifications, voice mode and lock-screen approvals.") : "Install it for full-screen chats and notifications."}</p>
      </div>
      <Button size="sm" onClick={() => void install()}>
        {installsNative ? "Download" : canPrompt ? "Install" : "How to"}
      </Button>
      <button type="button" onClick={dismissBanner} className="-mr-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken" aria-label="Not now">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

/** Step-by-step "Add to Home Screen" instructions. Rendered once in the app shell; opened from the banner or Settings. */
export const InstallAppSheet: FC = () => {
  const open = useUiStore((s) => s.install_sheet_open);
  const setOpen = useUiStore((s) => s.setInstallSheetOpen);
  const { target, iosBrowser, canPrompt, install } = useInstallApp();
  const steps = installSteps(target, iosBrowser);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="mx-auto max-w-[560px] rounded-t-xl border-hairline bg-canvas px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6">
        <SheetHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <AppIcon className="h-12 w-12" />
          <div className="min-w-0">
            <SheetTitle className="font-display text-xl font-bold text-ink">Install Agent Space</SheetTitle>
            <SheetDescription>{target === InstallTargets.IOS ? "Add it to your Home Screen — it opens full screen, like any other app." : "Add it to your home screen — it opens full screen, like any other app."}</SheetDescription>
          </div>
        </SheetHeader>

        <ol className="mt-5 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink">
                <step.icon className="h-[18px] w-[18px]" />
              </span>
              <p className="flex-1 text-sm text-body">
                <span className="mr-1 font-bold text-muted-foreground">{i + 1}.</span>
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        {target === InstallTargets.IOS && (
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" /> On iPhone and iPad, notifications only work from the Home Screen app (iOS 16.4 or later).
          </p>
        )}

        {canPrompt && (
          <Button className="mt-5 w-full" size="lg" onClick={() => void install().then(() => setOpen(false))}>
            <Download /> Install now
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
};
