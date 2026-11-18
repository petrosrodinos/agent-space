import type { FC, ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/components/ui/setting-row";
import { SegmentedControl } from "@/components/ui/segmented-control";

/** Instant-save setting rows: each change is saved on its own (optimistic). */
export const SwitchSetting: FC<{ label: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, description, checked, onChange, disabled }) => (
  <SettingRow label={label} description={description}>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
  </SettingRow>
);

export function SelectSetting<T extends string>({ label, description, value, options, onChange, disabled }: { label: string; description?: ReactNode; value: T | null | undefined; options: readonly { id: T | string; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <SettingRow label={label} description={description}>
      <Select value={value ?? undefined} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-[260px]" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
  );
}

export function SegmentSetting<T extends string>({ label, description, value, options, onChange, disabled }: { label: string; description?: ReactNode; value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <SettingRow label={label} description={description}>
      <SegmentedControl ariaLabel={label} value={value} options={options} onChange={onChange} disabled={disabled} />
    </SettingRow>
  );
}
