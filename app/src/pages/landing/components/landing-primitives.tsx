import { useEffect, useRef, useState, type FC, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TILE_SIZES = { 24: "h-6 w-6 rounded-sm [&_svg]:size-3.5", 32: "h-8 w-8 rounded-sm [&_svg]:size-4", 40: "h-10 w-10 rounded-md [&_svg]:size-5", 56: "h-14 w-14 rounded-lg [&_svg]:size-7" } as const;

/** A bot squircle filled with its colour and a lucide icon (landing stand-in for the emoji avatar). */
export const BotTile: FC<{ color: string; icon: LucideIcon; size?: keyof typeof TILE_SIZES; className?: string }> = ({ color, icon: Icon, size = 32, className }) => (
  <span className={cn("inline-flex shrink-0 items-center justify-center text-white", TILE_SIZES[size], className)} style={{ backgroundColor: color }}>
    <Icon strokeWidth={2.4} />
  </span>
);

/** Fades its children up the first time they scroll into view. */
export const Reveal: FC<{ children: ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", visible && "is-visible", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

export const SectionHeading: FC<{ overline: string; title: ReactNode; text?: ReactNode; className?: string; align?: "center" | "left" }> = ({ overline, title, text, className, align = "center" }) => (
  <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
    <p className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-muted-foreground">{overline}</p>
    <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.8px] text-ink sm:text-[44px]">{title}</h2>
    {text && <p className="mt-4 text-[16px] leading-relaxed text-body sm:text-[17px]">{text}</p>}
  </Reveal>
);
