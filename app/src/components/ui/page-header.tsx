import type { FC, ReactNode } from "react";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Mobile back target when there is no previous in-app screen (default: the parent path, else Chats). */
  backTo?: string;
}

/** Page title in Bricolage (display-md) with optional actions. On mobile a round back button sits on the title row. */
export const PageHeader: FC<PageHeaderProps> = ({ title, description, actions, className, backTo }) => (
  <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <BackButton fallback={backTo} className="md:hidden" />
        <h1 className="min-w-0 font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{title}</h1>
      </div>
      {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Standard page container: 32px padding desktop, 16px mobile. */
export const PageContainer: FC<{ children: ReactNode; className?: string; wide?: boolean }> = ({ children, className, wide }) => (
  <div className={cn("mx-auto w-full px-4 pb-6 pt-[calc(12px+env(safe-area-inset-top))] sm:px-8 md:py-8", wide ? "max-w-[1400px]" : "max-w-[1100px]", className)}>{children}</div>
);
