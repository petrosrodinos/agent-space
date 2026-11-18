import { useMemo, useState, type FC } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/config/constants/browser.constants";

const ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return [DEFAULT_TIMEZONE, "Europe/Athens", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];
  }
})();

/** Searchable time-zone combobox (Popover + Command). */
export const TimezonePicker: FC<{ value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }> = ({ value, onChange, disabled, id }) => {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => (ZONES.includes(DEFAULT_TIMEZONE) ? ZONES : [DEFAULT_TIMEZONE, ...ZONES]), []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="h-[42px] w-full justify-between rounded-md font-medium sm:w-[260px]">
          <span className="truncate">{value || "Choose a time zone"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search time zones" />
          <CommandList className="max-h-72">
            <CommandEmpty>No time zone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((z) => (
                <CommandItem key={z} value={z} onSelect={() => { onChange(z); setOpen(false); }}>
                  <Check className={cn("mr-1 h-4 w-4", value === z ? "opacity-100" : "opacity-0")} />
                  {z.replace(/_/g, " ")}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
