import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const VARIANT_ICONS: Record<string, LucideIcon> = {
  success: CheckCircle2,
  destructive: XCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICONS[variant ?? "success"];

        return (
          <Toast key={id} variant={variant} {...props}>
            {Icon && <Icon className="mt-0.5 h-5 w-5 flex-none" />}
            {/* Text is selectable with the mouse; Radix's swipe-to-dismiss captures the pointer and would block selecting, so mouse presses here don't start a swipe (touch swipes still work). */}
            <div
              className="grid flex-1 cursor-text select-text gap-1"
              onPointerDown={(e) => {
                if (e.pointerType === "mouse") e.stopPropagation();
              }}
            >
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
