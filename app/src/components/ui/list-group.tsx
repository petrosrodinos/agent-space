import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const ListRowTones = { DEFAULT: "default", DESTRUCTIVE: "destructive" } as const;
export type ListRowTone = (typeof ListRowTones)[keyof typeof ListRowTones];

/** A titled, rounded card of rows (iOS / Grok settings style). `footer` is helper text under the card. */
export const ListGroup: FC<{ title?: string; footer?: ReactNode; children: ReactNode; className?: string }> = ({ title, footer, children, className }) => (
  <section className={className}>
    {title && <h2 className="mb-1.5 px-4 text-[13px] font-semibold text-muted-foreground">{title}</h2>}
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker">{children}</div>
    {footer && <p className="mt-1.5 px-4 text-[13px] text-muted-foreground">{footer}</p>}
  </section>
);

interface ListRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  /** Short status on the right, e.g. "Idle" or "3 on". */
  value?: ReactNode;
  badge?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Control on the right (e.g. a switch) instead of a chevron. */
  trailing?: ReactNode;
  tone?: ListRowTone;
}

/** One row of a ListGroup: icon, label (+ description), value and a chevron. A link when `to` is set, a button when `onClick` is. */
export const ListRow: FC<ListRowProps> = ({ icon: Icon, label, description, value, badge, to, onClick, trailing, tone = ListRowTones.DEFAULT }) => {
  const interactive = !!to || !!onClick;
  const content = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5",
            description ? "h-10 w-10 rounded-md bg-primary-soft text-accent-foreground" : "w-6",
            tone === ListRowTones.DESTRUCTIVE ? "text-error" : !description && "text-body",
          )}
        >
          <Icon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-bold", tone === ListRowTones.DESTRUCTIVE ? "text-error" : "text-ink")}>{label}</span>
        {description && <span className="block text-[13px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      {badge}
      {value !== undefined && <span className="shrink-0 text-[15px] text-muted-foreground">{value}</span>}
      {trailing ?? (interactive && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />)}
    </>
  );
  const className = cn(
    "flex w-full items-center gap-3 border-b border-hairline px-4 text-left last:border-b-0",
    description ? "min-h-[68px] py-3" : "min-h-[56px] py-2",
    interactive && "transition-colors hover:bg-surface-sunken active:bg-surface-sunken",
  );

  if (to)
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
};
