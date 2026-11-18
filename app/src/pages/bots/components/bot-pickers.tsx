import type { FC } from "react";
import { Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { BotColorOptions, BotEmojiSuggestions, DEFAULT_BOT_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { ModelCostTierOptions, ModelLabelOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useModels } from "@/features/bots/hooks/use-bots";
import { cn } from "@/lib/utils";

export const EmojiPicker: FC<{ value: string; color: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, color, onChange, disabled }) => (
  <Popover>
    <PopoverTrigger asChild disabled={disabled}>
      <button type="button" className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] text-3xl shadow-sticker transition-transform hover:scale-105 disabled:opacity-60" style={{ backgroundColor: color }} aria-label="Choose emoji">
        {value || DEFAULT_BOT_EMOJI}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 rounded-[14px] p-3">
      <div className="grid grid-cols-6 gap-1">
        {BotEmojiSuggestions.map((e) => (
          <button key={e} type="button" onClick={() => onChange(e)} className={cn("h-10 rounded-[10px] text-2xl hover:bg-surface-sunken", value === e && "bg-primary-soft")} aria-label={e}>
            {e}
          </button>
        ))}
      </div>
      <Input className="mt-2" maxLength={8} placeholder="Or type any emoji" value={value} onChange={(ev) => onChange(ev.target.value)} aria-label="Custom emoji" />
    </PopoverContent>
  </Popover>
);

export const ColorSwatches: FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bot colour">
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
          className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[12px] transition-transform hover:scale-110 disabled:opacity-60", active && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
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
export const ModelSelect: FC<{ value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean; id?: string }> = ({ value, onChange, disabled, id }) => {
  const { data: models } = useModels();
  const allowed = (models ?? []).filter((m) => m.allowed);
  return (
    <Select value={value ?? RECOMMENDED} onValueChange={(v) => onChange(v === RECOMMENDED ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} aria-label="AI model">
        <SelectValue placeholder="Recommended" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={RECOMMENDED}>Recommended (organisation default)</SelectItem>
        {allowed.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-muted-foreground">{m.provider}</span>
              <span className="text-xs text-muted-foreground">· {m.labels.map((l) => getDropdownOptionLabel(ModelLabelOptions, l, l)).slice(0, 2).join(", ")}</span>
              <span className="text-xs font-bold text-muted-foreground">{getDropdownOptionLabel(ModelCostTierOptions, m.cost_tier)}</span>
              {m.is_recommended && <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-bold text-accent-foreground">Recommended</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
