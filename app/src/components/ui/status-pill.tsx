import type { FC, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "working";

const TONES: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-sunken text-body",
  working: "bg-primary-soft text-accent-foreground",
};

const ICONS: Record<StatusTone, ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  error: <XCircle className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />,
  neutral: <Clock className="h-3.5 w-3.5" />,
  working: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
};

/** Status is never shown by colour alone: icon + word (DESIGN.MD). */
export const StatusPill: FC<{ tone: StatusTone; children: ReactNode; className?: string }> = ({ tone, children, className }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>
    {ICONS[tone]}
    {children}
  </span>
);
