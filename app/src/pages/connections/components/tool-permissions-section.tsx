import { useMemo, useState, type FC } from "react";
import { ChevronRight, Search, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSetToolPermissions } from "@/features/connections/hooks/use-connections";
import type { ServiceTool, ToolGroup, ToolPermission } from "@/features/connections/interfaces/connections.interfaces";
import { ToolGroups, ToolPermissions } from "@/features/connections/interfaces/connections.interfaces";
import { ToolGroupOptions, ToolPermissionFilterOptions, ToolPermissionOptions, type ToolPermissionFilter } from "@/config/constants/dropdowns/connections/tool-permission.options";
import { ALL_FILTER } from "@/config/constants/filters";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ToolPermissionMenu } from "./tool-permission-menu";

/** Lists longer than this get a search box. */
const SEARCH_THRESHOLD = 12;
const GROUP_ORDER: ToolGroup[] = [ToolGroups.READ, ToolGroups.WRITE];

type CheckState = boolean | "indeterminate";
const checkState = (slugs: string[], selected: Set<string>): CheckState => {
  const n = slugs.filter((s) => selected.has(s)).length;
  return n === 0 ? false : n === slugs.length ? true : "indeterminate";
};
/** The permission every tool shares, or null ("Mixed"). */
const sharedPermission = (tools: ServiceTool[]) => (tools.length && tools.every((t) => t.permission === tools[0].permission) ? tools[0].permission : null);

const ToolGroupSection: FC<{
  group: ToolGroup;
  tools: ServiceTool[];
  forceOpen: boolean;
  selected: Set<string>;
  onToggle: (slugs: string[], on: boolean) => void;
  onChange: (slugs: string[], p: ToolPermission) => void;
}> = ({ group, tools, forceOpen, selected, onToggle, onChange }) => {
  const [open, setOpen] = useState(false);
  const label = getDropdownOptionLabel(ToolGroupOptions, group);
  const slugs = tools.map((t) => t.slug);
  const isOpen = open || forceOpen;
  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className="border-b border-hairline last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox className="ml-1" checked={checkState(slugs, selected)} onCheckedChange={(v) => onToggle(slugs, v === true)} aria-label={`Select all ${label.toLowerCase()}`} />
        <CollapsibleTrigger className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden />
          <span className="text-[15px] font-bold text-ink">{label}</span>
          <span className="text-[13px] text-muted-foreground">{tools.length}</span>
        </CollapsibleTrigger>
        <ToolPermissionMenu value={sharedPermission(tools)} emphasis ariaLabel={`Permission for all ${label.toLowerCase()}`} onChange={(p) => onChange(slugs, p)} />
      </div>
      <CollapsibleContent>
        <ul className="pb-1.5">
          {tools.map((t) => (
            <li key={t.slug} className={cn("flex items-center gap-3 py-1.5 pl-4 pr-3", selected.has(t.slug) && "bg-surface-sunken")}>
              <Checkbox checked={selected.has(t.slug)} onCheckedChange={(v) => onToggle([t.slug], v === true)} aria-label={`Select ${t.name}`} />
              <div className="min-w-0 flex-1 pl-1">
                <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                {t.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground" title={t.description}>
                    {t.description}
                  </p>
                )}
              </div>
              <ToolPermissionMenu value={t.permission} ariaLabel={`Permission for ${t.name}`} onChange={(p) => onChange([t.slug], p)} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};

/**
 * Tool permissions for one service: filter by current permission, pick tools (one by one, per group or all shown)
 * and set a permission on all of them at once.
 */
export const ToolPermissionsSection: FC<{ serviceSlug: string; serviceName: string; tools: ServiceTool[] }> = ({ serviceSlug, serviceName, tools }) => {
  const setPermissions = useSetToolPermissions(serviceSlug);
  const [search, setSearch] = useState("");
  const [chosenFilter, setFilter] = useState<ToolPermissionFilter>(ALL_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = search.trim().toLowerCase();
  const counts = useMemo(() => {
    const c = new Map<ToolPermissionFilter, number>([[ALL_FILTER, tools.length]]);
    for (const t of tools) c.set(t.permission, (c.get(t.permission) ?? 0) + 1);
    return c;
  }, [tools]);
  // A bulk change can empty the chosen filter (e.g. nothing is Blocked any more): fall back to All.
  const filter: ToolPermissionFilter = counts.get(chosenFilter) ? chosenFilter : ALL_FILTER;
  const visible = useMemo(
    () => tools.filter((t) => (filter === ALL_FILTER || t.permission === filter) && (!query || t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query))),
    [tools, filter, query],
  );
  const grouped = useMemo(() => GROUP_ORDER.map((g) => ({ group: g, tools: visible.filter((t) => t.group === g) })).filter((g) => g.tools.length), [visible]);
  const visibleSlugs = useMemo(() => visible.map((t) => t.slug), [visible]);

  const toggle = (slugs: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of slugs) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });

  const apply = (slugs: string[], permission: ToolPermission, opts: { bulk?: boolean } = {}) =>
    setPermissions.mutate(
      { tool_slugs: slugs, permission },
      {
        onSuccess: () => {
          if (!opts.bulk) return;
          setSelected(new Set());
          toast({ title: `${slugs.length} ${slugs.length === 1 ? "tool" : "tools"} set to ${getDropdownOptionLabel(ToolPermissionOptions, permission)}`, duration: 2000 });
        },
      },
    );

  const selectedSlugs = [...selected];
  const allShown = checkState(visibleSlugs, selected);

  if (!tools.length) {
    return (
      <section>
        <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">Tool permissions</h2>
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-4 text-sm text-muted-foreground shadow-sticker">
          <Wrench className="h-4 w-4" /> {serviceName} doesn't list any tools.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="px-1 text-[13px] font-semibold text-muted-foreground">
          Tool permissions<span className="ml-1.5 font-normal">{tools.length}</span>
        </h2>
        {tools.length > SEARCH_THRESHOLD && (
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 pl-10" placeholder="Search tools" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tools" />
          </div>
        )}
      </div>

      <div className="scrollbar-thin -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by permission">
        {ToolPermissionFilterOptions.map((o) => {
          const n = counts.get(o.id) ?? 0;
          const active = filter === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={!n && !active}
              onClick={() => setFilter(o.id)}
              className={cn(
                "inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-colors disabled:opacity-40",
                active ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-body hover:bg-hairline",
              )}
            >
              {o.label}
              <span className={cn("font-semibold", active ? "opacity-70" : "text-muted-foreground")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker">
        {!visible.length ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No tools match{query ? ` "${search}"` : " this filter"}.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-hairline bg-surface-sunken/50 px-3 py-2">
              <Checkbox className="ml-1" checked={allShown} onCheckedChange={(v) => toggle(visibleSlugs, v === true)} aria-label="Select all shown tools" />
              <span className="min-w-0 flex-1 pl-1 text-[13px] font-semibold text-muted-foreground">
                {filter === ALL_FILTER && !query ? "All tools" : `${visible.length} shown`}
              </span>
              <ToolPermissionMenu value={sharedPermission(visible)} emphasis ariaLabel="Permission for all shown tools" onChange={(p) => apply(visibleSlugs, p, { bulk: true })} />
            </div>
            {grouped.map((g) => (
              <ToolGroupSection key={g.group} group={g.group} tools={g.tools} forceOpen={!!query || filter !== ALL_FILTER} selected={selected} onToggle={toggle} onChange={(slugs, p) => apply(slugs, p)} />
            ))}
          </>
        )}
      </div>
      <p className="mt-1.5 px-1 text-[13px] text-muted-foreground">
        These apply when bots act for you. Always allow skips your bots' ask-first rules for that tool; your organisation's required approvals still apply. Blocked tools are never offered to bots.
      </p>

      {selectedSlugs.length > 0 && (
        <div className="sticky bottom-[calc(12px+env(safe-area-inset-bottom))] z-20 mt-3 flex flex-col gap-2 rounded-lg border border-hairline-strong bg-surface p-3 shadow-pop sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X />
            </Button>
            <span className="text-sm font-bold text-ink">{selectedSlugs.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {ToolPermissionOptions.map((o) => (
              <Button
                key={o.id}
                size="sm"
                variant="outline"
                className={cn(o.id === ToolPermissions.BLOCKED && "text-error")}
                disabled={setPermissions.isPending}
                title={o.description}
                onClick={() => apply(selectedSlugs, o.id, { bulk: true })}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
