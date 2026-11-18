import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

/** Pills inside a sunken pill track (DESIGN.MD inputs). Keyboard accessible via radiogroup semantics. */
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel, className, disabled }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-[18px] bg-surface-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-[34px] rounded-full px-3.5 text-sm font-bold transition-all duration-150",
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
