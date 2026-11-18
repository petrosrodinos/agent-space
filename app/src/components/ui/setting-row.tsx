import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A row in a settings card: label + helper on the left, control on the right (stacks on mobile). */
export const SettingRow: FC<{ label: string; description?: ReactNode; children: ReactNode; className?: string; htmlFor?: string; stack?: boolean }> = ({ label, description, children, className, htmlFor, stack }) => (
  <div className={cn("flex flex-col gap-3 border-b border-hairline py-4 last:border-b-0", !stack && "sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[15px] font-bold text-ink">
        {label}
      </label>
      {description && <div className="mt-0.5 text-[13px] text-muted-foreground">{description}</div>}
    </div>
    <div className={cn("shrink-0", stack && "w-full")}>{children}</div>
  </div>
);

/** Grouped settings card (DESIGN.MD: single 720px column of grouped setting cards). */
export const SettingsCard: FC<{ title: string; description?: string; children: ReactNode; className?: string; actions?: ReactNode }> = ({ title, description, children, className, actions }) => (
  <section className={cn("rounded-lg border border-hairline bg-surface px-5 py-4 shadow-sticker sm:px-6", className)}>
    <div className="flex items-start justify-between gap-3 pb-1 pt-1">
      <div>
        <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
    <div>{children}</div>
  </section>
);
