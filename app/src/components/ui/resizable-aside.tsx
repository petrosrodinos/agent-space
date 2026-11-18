import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FC, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const KEY_STEP = 24;
/** Open/close animation length; matches the `duration-300` classes below. */
const TRANSITION_MS = 300;

interface ResizableAsideProps {
  /** Animates in when true and out when false; children stay mounted until the close animation ends. */
  open: boolean;
  width: number;
  min: number;
  max: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
  className?: string;
  /** Accessible name of the drag handle. */
  handleLabel?: string;
}

/**
 * Right-hand panel that slides open (pushing the content beside it) and whose left edge can be dragged, or moved with
 * the arrow keys, to resize it. Width changes animate except while dragging, so the edge tracks the pointer exactly.
 */
export const ResizableAside: FC<ResizableAsideProps> = ({ open, width, min, max, onWidthChange, children, className, handleLabel = "Resize panel" }) => {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Mounted while open and during the close animation; `shown` flips a frame after mounting so the open animates too.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Once mounted at width 0, force a layout so the browser records that width, then expand: the width transition runs.
  useLayoutEffect(() => {
    if (!mounted || !open || shown) return;
    asideRef.current?.getBoundingClientRect();
    setShown(true);
  }, [mounted, open, shown]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, width };
      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!start.current) return;
      onWidthChange(start.current.width + (start.current.x - e.clientX));
    },
    [onWidthChange],
  );
  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    start.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") onWidthChange(width + KEY_STEP);
    else if (e.key === "ArrowRight") onWidthChange(width - KEY_STEP);
    else return;
    e.preventDefault();
  };

  if (!mounted) return null;

  return (
    <aside
      ref={asideRef}
      aria-hidden={!shown}
      className={cn("relative shrink-0", !dragging && "transition-[width] duration-300 ease-[var(--ease-standard)]", className)}
      style={{ width: shown ? width : 0 }}
    >
      {shown && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={handleLabel}
          aria-valuenow={width}
          aria-valuemin={min}
          aria-valuemax={max}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onDoubleClick={() => onWidthChange(min)}
          className="group absolute inset-y-0 -left-1.5 z-20 flex w-3 cursor-col-resize justify-center focus-visible:outline-none"
        >
          <span
            className={cn(
              "h-full w-px bg-hairline transition-[background-color,width] duration-150 group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary",
              dragging && "w-0.5 bg-primary",
            )}
          />
        </div>
      )}
      {/* Fixed-width inner layer: the content slides and fades instead of reflowing while the outer width animates. */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn("h-full transition-[opacity,transform] duration-300 ease-[var(--ease-standard)]", shown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0")}
          style={{ width }}
        >
          {children}
        </div>
      </div>
    </aside>
  );
};
