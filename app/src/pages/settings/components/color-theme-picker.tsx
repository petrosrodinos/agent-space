import type { FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorThemeFormOptions } from "@/config/constants/dropdowns/users/color-theme-form.options";
import type { ColorTheme } from "@/features/users/interfaces/users.interfaces";

interface ColorThemePickerProps {
  value: ColorTheme;
  onChange: (value: ColorTheme) => void;
  disabled?: boolean;
}

/**
 * Grid of colour theme presets. Each card sets data-color-theme on itself, so the preview
 * renders with that preset's real tokens (and follows light/dark mode).
 */
export const ColorThemePicker: FC<ColorThemePickerProps> = ({ value, onChange, disabled }) => (
  <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {ColorThemeFormOptions.map((option) => {
      const selected = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          data-color-theme={option.id}
          onClick={() => !selected && onChange(option.id)}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-md border-2 bg-surface text-left transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60",
            selected ? "border-primary" : "border-hairline hover:border-hairline-strong",
          )}
        >
          {/* Mini app preview: sidebar, a bubble and a primary button. */}
          <div className="flex h-16 bg-canvas">
            <div className="flex w-1/4 flex-col gap-1 border-r border-hairline bg-surface-soft p-1.5">
              <span className="h-1.5 rounded-full bg-primary" />
              <span className="h-1.5 rounded-full bg-surface-sunken" />
              <span className="h-1.5 rounded-full bg-surface-sunken" />
            </div>
            <div className="flex flex-1 flex-col justify-between p-2">
              <span className="h-3 w-3/4 rounded-sm bg-primary-soft" />
              <span className="ml-auto h-3 w-1/2 rounded-sm bg-primary" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-hairline px-2.5 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{option.label}</p>
              <p className="truncate text-xs text-muted-foreground">{option.description}</p>
            </div>
            {selected && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>
        </button>
      );
    })}
  </div>
);
