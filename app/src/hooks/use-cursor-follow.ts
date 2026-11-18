import { useEffect, type RefObject } from "react";

interface CursorFollowOptions {
  /** Distance in px from the element's centre within which it reacts to the pointer. */
  radius?: number;
  /** Maximum shift in px toward the pointer. */
  maxShift?: number;
  /** Maximum tilt in degrees toward the pointer. */
  maxTilt?: number;
  enabled?: boolean;
}

/**
 * Makes an element "look at" a nearby mouse pointer: it shifts and tilts toward the cursor while it is within
 * `radius`, and eases back to rest when the cursor leaves. Writes the transform directly (no re-renders).
 * Skipped for touch-only devices and when the user prefers reduced motion.
 */
export function useCursorFollow(ref: RefObject<HTMLElement | null>, { radius = 280, maxShift = 10, maxTilt = 12, enabled = true }: CursorFollowOptions = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    el.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.willChange = "transform";

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist > radius || dist === 0) {
          el.style.transform = "";
          return;
        }
        // Stronger pull at mid-range, fading out toward the edge of the radius.
        const strength = Math.min(1, dist / (radius * 0.35)) * (1 - dist / radius) * 1.6;
        const tx = (dx / dist) * maxShift * strength;
        const ty = (dy / dist) * maxShift * strength;
        const tilt = (dx / radius) * maxTilt;
        el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      el.style.transform = "";
      el.style.transition = "";
      el.style.willChange = "";
    };
  }, [ref, radius, maxShift, maxTilt, enabled]);
}
