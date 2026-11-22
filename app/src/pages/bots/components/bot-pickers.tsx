import { useState, type FC } from "react";
import { Check, Shuffle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { randomAvatarSeeds } from "@/components/ui/bot-portrait";
import { BotColorOptions } from "@/config/constants/dropdowns/shared/bot-colors.options";
import {
  ModelCostTierOptions,
  ModelLabelOptions,
} from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useModels } from "@/features/bots/hooks/use-bots";
import { cn } from "@/lib/utils";

const PRESET_COUNT = 8;

/** The current seed first, then random ones. */
const presetsAround = (current: string, count: number) => [current, ...randomAvatarSeeds(count - 1)];

/**
 * Inline avatar chooser: random preselected portraits plus "Shuffle", which deals a fresh set and selects the
 * first. The bot colour stays the background, so only the face changes.
 */
export const AvatarPresets: FC<{
  value: string;
  color: string;
  onChange: (seed: string) => void;
  disabled?: boolean;
  count?: number;
  className?: string;
}> = ({ value, color, onChange, disabled, count = PRESET_COUNT, className }) => {
  const [options, setOptions] = useState(() => presetsAround(value, count));
  const shuffle = () => {
    const next = randomAvatarSeeds(count);
    setOptions(next);
    onChange(next[0]);
  };
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {options.map((seed, i) => {
          const selected = seed === value;
          return (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Avatar ${i + 1}`}
              disabled={disabled}
              onClick={() => onChange(seed)}
              className={cn(
                "rounded-md transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60",
                selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
              )}
            >
              <BotAvatar seed={seed} color={color} size={40} />
            </button>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={shuffle} disabled={disabled}>
        <Shuffle className="h-4 w-4" aria-hidden /> Shuffle
      </Button>
    </div>
  );
};

/** Compact avatar control for forms: the current portrait opens a popover with the presets and Shuffle. */
export const AvatarPicker: FC<{
  value: string;
  color: string;
  onChange: (seed: string) => void;
  disabled?: boolean;
}> = ({ value, color, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className="rounded-lg shadow-sticker transition-transform hover:scale-105 disabled:opacity-60" aria-label="Choose avatar">
          <BotAvatar seed={value} color={color} size={56} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-md p-3">
        <AvatarPresets value={value} color={color} onChange={onChange} disabled={disabled} />
      </PopoverContent>
    </Popover>
  );
};

export const ColorSwatches: FC<{
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
    {BotColorOptions.map((c) => {
      const active = value?.toLowerCase() === c.id.toLowerCase();
      return (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={c.label}
          title={c.label}
          disabled={disabled}
          onClick={() => onChange(c.id)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md transition-transform hover:scale-110 disabled:opacity-60",
            active && "ring-2 ring-ink ring-offset-2 ring-offset-surface"
          )}
          style={{ backgroundColor: c.id }}
        >
          {active && <Check className="h-4 w-4 text-white drop-shadow" />}
        </button>
      );
    })}
  </div>
);

export const RECOMMENDED = "recommended";

/** Model picker: name, maker, plain-language labels and cost indicator (§6.4). */
export const ModelSelect: FC<{
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  id?: string;
}> = ({ value, onChange, disabled, id }) => {
  const { data: models } = useModels();
  const allowed = (models ?? []).filter((m) => m.allowed);
  return (
    <Select
      value={value ?? RECOMMENDED}
      onValueChange={(v) => onChange(v === RECOMMENDED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label="AI model">
        <SelectValue placeholder="Recommended" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={RECOMMENDED}>
          Recommended (organisation default)
        </SelectItem>
        {allowed.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-muted-foreground">
                {m.provider}
              </span>
              <span className="text-xs text-muted-foreground">
                ·{" "}
                {m.labels
                  .map((l) => getDropdownOptionLabel(ModelLabelOptions, l, l))
                  .slice(0, 2)
                  .join(", ")}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {getDropdownOptionLabel(ModelCostTierOptions, m.cost_tier)}
              </span>
              {m.is_recommended && (
                <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-bold text-accent-foreground">
                  Recommended
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
