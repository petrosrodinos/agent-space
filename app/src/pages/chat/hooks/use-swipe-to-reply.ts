import { useCallback, useRef, type TouchEvent } from "react";

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 84;
const AXIS_LOCK_PX = 10;
const HAPTIC_MS = 12;
/** Horizontal drags inside these belong to the control itself (sliders, scrollable tables, code), not to reply. */
const IGNORE_SELECTOR = "input,textarea,select,pre,table,canvas,[data-no-swipe]";
const SwipeAxes = { HORIZONTAL: "h", VERTICAL: "v" } as const;
type SwipeAxis = (typeof SwipeAxes)[keyof typeof SwipeAxes];

interface Options {
  enabled: boolean;
  onReply: () => void;
}

/**
 * Swipe a message to the right to reply (Messenger-style). The row follows the finger with resistance and a reply icon
 * fades in; releasing past the threshold triggers `onReply`. Movement is written straight to the DOM so dragging never
 * re-renders the message list. The row must have `touch-action: pan-y` so vertical scrolling stays native.
 */
export function useSwipeToReply({ enabled, onReply }: Options) {
  const rowRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const gesture = useRef<{ x: number; y: number; axis: SwipeAxis | null; armed: boolean } | null>(null);

  const paint = useCallback((offset: number, animate: boolean) => {
    const row = rowRef.current;
    if (!row) return;
    row.style.transition = animate ? "transform 180ms ease-out" : "none";
    row.style.transform = offset ? `translateX(${offset}px)` : "";
    const hint = hintRef.current;
    if (hint) {
      const progress = Math.min(offset / SWIPE_TRIGGER_PX, 1);
      hint.style.opacity = String(progress);
      hint.style.transform = `translateY(-50%) scale(${0.6 + 0.4 * progress})`;
    }
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    if (!enabled || e.touches.length !== 1 || (e.target as Element).closest(IGNORE_SELECTOR)) return;
    gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null, armed: false };
  };

  const onTouchMove = (e: TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.touches[0].clientX - g.x;
    const dy = e.touches[0].clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) && dx > 0 ? SwipeAxes.HORIZONTAL : SwipeAxes.VERTICAL;
    }
    if (g.axis !== SwipeAxes.HORIZONTAL) return;
    // Rubber-band past the trigger so it feels like pulling against a spring.
    const offset = dx <= SWIPE_TRIGGER_PX ? Math.max(dx, 0) : Math.min(SWIPE_TRIGGER_PX + (dx - SWIPE_TRIGGER_PX) * 0.35, SWIPE_MAX_PX);
    if (dx >= SWIPE_TRIGGER_PX && !g.armed) {
      g.armed = true;
      navigator.vibrate?.(HAPTIC_MS);
    } else if (dx < SWIPE_TRIGGER_PX) g.armed = false;
    paint(offset, false);
  };

  const finish = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    paint(0, true);
    if (!cancelled && g.axis === SwipeAxes.HORIZONTAL && g.armed) onReply();
  };

  return {
    rowRef,
    hintRef,
    /** True while a horizontal drag is in progress — callers use it to cancel competing gestures such as long-press. */
    isSwiping: () => gesture.current?.axis === SwipeAxes.HORIZONTAL,
    handlers: { onTouchStart, onTouchMove, onTouchEnd: () => finish(false), onTouchCancel: () => finish(true) },
  };
}
