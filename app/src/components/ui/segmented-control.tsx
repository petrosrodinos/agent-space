import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  /** Stretch to the container: one row of equal-width segments (long labels wrap inside their segment). */
  fullWidth?: boolean;
}

/** Pills inside a sunken pill track (DESIGN.MD inputs). Keyboard accessible via radiogroup semantics. */
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel, className, disabled, fullWidth }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("gap-1 rounded-lg bg-surface-sunken p-1", fullWidth ? "grid w-full auto-cols-fr grid-flow-col" : "flex w-fit max-w-full flex-wrap", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-control-sm rounded-full px-3.5 text-sm font-bold transition-all duration-150",
            fullWidth && "px-2 py-1.5 text-center leading-tight",
            value === o.id ? "bg-surface text-ink shadow-sticker" : "text-muted-foreground hover:text-ink",
            disabled && "opacity-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
