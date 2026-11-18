import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Masked input with a show/hide eye that only works on this screen. Values are never shown again after saving. */
export const SecretField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(({ className, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} autoComplete="off" spellCheck={false} className={cn("pr-12 font-mono", className)} {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken" aria-label={show ? "Hide" : "Show"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
SecretField.displayName = "SecretField";
