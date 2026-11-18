import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader } from "lucide-react";
import { cn } from "@/lib/utils";

// DESIGN.MD buttons: pills, sticker shadows, pressed = move down 2px and lose the shadow.
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-[transform,box-shadow,background-color] duration-[90ms] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-glow disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-sticker-strong hover:bg-primary-hover",
      destructive: "bg-destructive text-white shadow-sticker-strong hover:bg-destructive/90",
      outline: "border-[1.5px] border-hairline-strong bg-surface text-ink shadow-sticker hover:bg-surface-soft",
      secondary: "bg-surface-sunken text-ink shadow-sticker hover:bg-hairline",
      ghost: "text-body hover:bg-primary-soft hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-10 px-5",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-8 text-[15px]",
      icon: "h-9 w-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading = false, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  const content = (
    <>
      {loading && <Loader className="animate-spin" />}
      {props.children}
    </>
  );

  return (
    // <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} disabled={loading || props.disabled}>
      {asChild ? <span className="inline-flex items-center gap-2">{content}</span> : content}
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
