import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Viewport>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn("fixed bottom-0 left-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 pb-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 sm:left-1/2 sm:right-auto sm:max-w-[420px] sm:-translate-x-1/2 sm:p-0", className)}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[20px] border p-4 pr-9 shadow-pop transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#1C1633] text-[#F6F3FF] dark:bg-[#F6F3FF] dark:text-[#1C1633]",
        success: "border-transparent bg-[#1C1633] text-[#F6F3FF] dark:bg-[#F6F3FF] dark:text-[#1C1633]",
        destructive: "border-red-500/20 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-950 dark:text-red-400",
        error: "border-error/30 bg-error-soft text-ink",
        warning: "border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-950 dark:text-amber-400",
        info: "border-blue-500/20 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-950 dark:text-blue-400",
        light: "border-border bg-secondary text-foreground",
        dark: "border-transparent bg-foreground text-background",
      },
    },
    defaultVariants: {
      variant: "success",
    },
  }
);

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Action>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action ref={ref} className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-current/25 bg-transparent px-3 text-sm font-medium transition-colors hover:bg-current/10 focus:outline-none focus:ring-1 focus:ring-current disabled:pointer-events-none disabled:opacity-50", className)} {...props} />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Close>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close ref={ref} className={cn("absolute right-2 top-2 rounded-md p-1 text-current/50 opacity-0 transition-opacity hover:bg-current/10 hover:text-current focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-current group-hover:opacity-100", className)} toast-close="" {...props}>
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Title>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>>(({ className, ...props }, ref) => <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold leading-snug [&+div]:text-xs", className)} {...props} />);
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Description>, React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>>(({ className, ...props }, ref) => <ToastPrimitives.Description ref={ref} className={cn("text-sm leading-snug opacity-80", className)} {...props} />);
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export { type ToastProps, type ToastActionElement, ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction };
