import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Page title in Bricolage (display-md) with optional actions. */
export const PageHeader: FC<PageHeaderProps> = ({ title, description, actions, className }) => (
  <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{title}</h1>
      {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Standard page container: 32px padding desktop, 16px mobile. */
export const PageContainer: FC<{ children: ReactNode; className?: string; wide?: boolean }> = ({ children, className, wide }) => (
  <div className={cn("mx-auto w-full px-4 py-6 sm:px-8 sm:py-8", wide ? "max-w-[1400px]" : "max-w-[1100px]", className)}>{children}</div>
);
