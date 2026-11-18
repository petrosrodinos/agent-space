import { useCallback, type FC, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { CircleButton } from "@/components/ui/circle-button";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

/** Parent of a path ("/settings/profile" → "/settings"); top-level pages fall back to Chats. */
const parentPath = (pathname: string) => {
  const parent = pathname.replace(/\/[^/]+\/?$/, "");
  return parent && parent !== Routes.home ? parent : Routes.chat.root;
};

/** Back: the previous in-app screen when there is one, otherwise the page's parent (deep links, notifications). */
export const useBack = (fallback?: string) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback ?? parentPath(pathname), { replace: true });
  }, [navigate, pathname, fallback]);
};

/** Round back button (see `useBack`). `fallback` is where to go when there is no previous in-app screen. */
export const BackButton: FC<{ fallback?: string; onClick?: () => void; className?: string }> = ({ fallback, onClick, className }) => {
  const back = useBack(fallback);
  return (
    <CircleButton onClick={onClick ?? back} className={className} aria-label="Back">
      <ChevronLeft />
    </CircleButton>
  );
};

interface MobileTopBarProps {
  /** Overrides the default back behaviour (e.g. leaving a sub-section of the same page). */
  onBack?: () => void;
  /** Centre content, e.g. a title pill. */
  center?: ReactNode;
  /** Round buttons on the right. */
  actions?: ReactNode;
  className?: string;
}

/** Grok-style top bar: round back button, optional centre pill, round actions. Sticks to the top of the scrolling page. */
export const MobileTopBar: FC<MobileTopBarProps> = ({ onBack, center, actions, className }) => {
  return (
    <div
      className={cn(
        "pointer-events-none sticky top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-canvas via-canvas/80 to-transparent px-3 pb-3 pt-[calc(12px+env(safe-area-inset-top))] [&>*]:pointer-events-auto",
        className,
      )}
    >
      <BackButton onClick={onBack} />
      <div className="flex min-w-0 flex-1 justify-start">{center}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
};
