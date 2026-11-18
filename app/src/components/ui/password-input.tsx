import * as React from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    return (
      <div className={cn("relative", className)}>
        <input
          type={showPassword ? "text" : "password"}
          className="flex h-[42px] w-full rounded-md border-[1.5px] border-hairline-strong bg-surface px-3.5 pr-11 py-1 text-base text-ink transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          ref={ref}
          disabled={disabled}
          {...props}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={showPassword ? "Hide" : "Show"} className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground shadow-none"
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? <IconEye size={18} /> : <IconEyeOff size={18} />}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
