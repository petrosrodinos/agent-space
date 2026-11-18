import type { FC, ReactNode } from "react";
import { Bot, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  stickers?: { icon: LucideIcon; color: string }[];
  className?: string;
}

const DEFAULT_STICKERS = [
  { icon: Bot, color: "#6B4EFF" },
  { icon: Sparkles, color: "#FF5FAE" },
  { icon: MessageCircle, color: "#38B6FF" },
];

/** Friendly empty state: tilted squircle "stickers", a Bricolage headline and one clear action (DESIGN.MD). */
export const EmptyState: FC<EmptyStateProps> = ({ title, description, action, stickers = DEFAULT_STICKERS, className }) => (
  <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
    <div className="mb-6 flex items-end gap-2" aria-hidden>
      {stickers.slice(0, 3).map(({ icon: Icon, color }, i) => (
        <span
          key={i}
          className="inline-flex h-16 w-16 items-center justify-center rounded-lg text-white shadow-sticker-strong"
          style={{ backgroundColor: color, transform: `rotate(${[-6, 4, -3][i]}deg) translateY(${[4, -6, 2][i]}px)` }}
        >
          <Icon className="h-8 w-8" strokeWidth={2.25} />
        </span>
      ))}
    </div>
    <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
    {description && <p className="mt-2 max-w-md text-[15px] text-muted-foreground">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
