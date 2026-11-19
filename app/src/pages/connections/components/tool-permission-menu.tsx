import type { FC } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ToolPermission } from "@/features/connections/interfaces/connections.interfaces";
import { ToolPermissions } from "@/features/connections/interfaces/connections.interfaces";
import { ToolPermissionOptions } from "@/config/constants/dropdowns/connections/tool-permission.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";

const MIXED_LABEL = "Mixed";

/**
 * Permission picker for one tool or a whole group. `value` null = the group's tools differ ("Mixed").
 * Blocked reads in the error colour so it stands out in a long list.
 */
export const ToolPermissionMenu: FC<{ value: ToolPermission | null; onChange: (p: ToolPermission) => void; ariaLabel: string; disabled?: boolean; emphasis?: boolean }> = ({
  value,
  onChange,
  ariaLabel,
  disabled,
  emphasis,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        emphasis ? "font-bold text-ink" : "font-semibold text-muted-foreground",
        value === ToolPermissions.BLOCKED && "text-error",
      )}
    >
      {value ? getDropdownOptionLabel(ToolPermissionOptions, value) : MIXED_LABEL}
      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-72 rounded-md p-1.5">
      {ToolPermissionOptions.map((o) => (
        <DropdownMenuItem key={o.id} className="items-start gap-2 rounded-sm py-2" onSelect={() => onChange(o.id)}>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-sm font-semibold", o.id === ToolPermissions.BLOCKED && "text-error")}>{o.label}</span>
            <span className="block text-xs leading-snug text-muted-foreground">{o.description}</span>
          </span>
          {value === o.id && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
