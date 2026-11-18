import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Button } from "@/components/ui/button";

export function SwitchField<T extends FieldValues>({ control, name, label, description, disabled }: { control: Control<T>; name: FieldPath<T>; label: string; description?: ReactNode; disabled?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <SettingRow label={label} description={description}>
          <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} aria-label={label} />
        </SettingRow>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, description, options, disabled }: { control: Control<T>; name: FieldPath<T>; label: string; description?: ReactNode; options: readonly { id: string; label: string }[]; disabled?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <SettingRow label={label} description={description}>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <FormControl>
                <SelectTrigger className="w-full sm:w-[260px]" aria-label={label}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export const SaveBar = ({ dirty, loading, readOnly }: { dirty: boolean; loading: boolean; readOnly?: boolean }) =>
  readOnly ? (
    <p className="pt-4 text-sm text-muted-foreground">Only people who can edit this bot can change these settings.</p>
  ) : (
    <div className="flex justify-end pt-4">
      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </div>
  );
