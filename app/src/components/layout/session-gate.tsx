import { useEffect, type FC, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { refreshSession } from "@/config/api/axios";
import { Routes } from "@/routes/routes";
import { useAuthStore, AuthStatuses } from "@/stores/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { isAppShell } from "@/platform";

let bootstrapped = false;

/** Re-establishes the session on load from the refresh cookie (web) or secure storage (native) — §14.1. */
export function useSessionBootstrap() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (bootstrapped || status !== AuthStatuses.UNKNOWN) return;
    bootstrapped = true;
    void refreshSession();
  }, [status]);
  return status;
}

export const SplashSkeleton: FC = () => (
  <div className="flex h-dvh w-full bg-canvas">
    <div className="hidden w-[288px] flex-col gap-3 border-r border-hairline bg-surface-soft p-4 md:flex">
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-9 w-full rounded-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <Skeleton className="h-16 w-16 rounded-lg" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
  </div>
);

export const RequireAuth: FC<{ children: ReactNode }> = ({ children }) => {
  const status = useSessionBootstrap();
  const location = useLocation();
  if (status === AuthStatuses.UNKNOWN) return <SplashSkeleton />;
  if (status === AuthStatuses.SIGNED_OUT) return <Navigate to={`${Routes.auth.sign_in}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
};

/**
 * `/`: on the web it is always the landing page (signed in or not — the page offers "Open app").
 * The desktop and mobile apps never show it: signed in goes to chats, signed out to sign-in.
 */
export const HomeGate: FC<{ landing?: ReactNode }> = ({ landing }) => {
  const status = useSessionBootstrap();
  if (!isAppShell && landing) return <>{landing}</>;
  if (status === AuthStatuses.UNKNOWN) return <SplashSkeleton />;
  if (status === AuthStatuses.SIGNED_IN) return <Navigate to={Routes.chat.root} replace />;
  return <Navigate to={Routes.auth.sign_in} replace />;
};

/** Wrap the landing page's own route with this: inside the apps it goes to `/` (chats or sign-in) instead. */
export const WebOnly: FC<{ children: ReactNode }> = ({ children }) => (isAppShell ? <Navigate to={Routes.home} replace /> : <>{children}</>);

export const RedirectIfAuthed: FC<{ children: ReactNode }> = ({ children }) => {
  const status = useSessionBootstrap();
  const location = useLocation();
  if (status === AuthStatuses.UNKNOWN) return <SplashSkeleton />;
  if (status === AuthStatuses.SIGNED_IN) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next && next.startsWith("/") ? next : Routes.chat.root} replace />;
  }
  return <>{children}</>;
};
