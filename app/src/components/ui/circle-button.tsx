import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Round floating icon button (Grok-style top bars): back, more, share, new. Always pass an `aria-label`. */
export const CircleButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "size">>(({ className, variant = "secondary", ...props }, ref) => (
  <Button ref={ref} variant={variant} size="icon" className={cn("h-11 w-11 shrink-0 rounded-full border border-hairline [&_svg]:size-5", className)} {...props} />
));
CircleButton.displayName = "CircleButton";
