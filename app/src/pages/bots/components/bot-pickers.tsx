import { type FC } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModelCostTierOptions,
  ModelLabelOptions,
} from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useModels } from "@/features/bots/hooks/use-bots";

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
