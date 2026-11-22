import { useMemo, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Pencil, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar, BotAvatar } from "@/components/ui/bot-avatar";
import { SettingsCard } from "@/components/ui/setting-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMembers } from "@/features/organizations/hooks/use-organizations";
import { useBots, useModels } from "@/features/bots/hooks/use-bots";
import { useSetUsageLimit, useUsage, useUsageCharges } from "@/features/usage/hooks/use-usage";
import { UsageLimitScopes, UsageKinds, type UsageCharge, type UsageKind, type UsageLimitScope, type UsageOverview } from "@/features/usage/interfaces/usage.interfaces";
import { UsageLimitScopeOptions, UsageRangeOptions, UsageRanges, type UsageRange } from "@/config/constants/dropdowns/organizations/organization-form.options";
import { UsageKindOptions } from "@/config/constants/dropdowns/shared/status.options";
import { ALL_FILTER } from "@/config/constants/filters";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, formatMoney, timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { SettingsSkeleton } from "./personal-sections";

const UsageTabs = { OVERVIEW: "overview", CHARGES: "charges" } as const;
type UsageTab = (typeof UsageTabs)[keyof typeof UsageTabs];
const TAB_PARAM = "tab";
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

/** Usage page: Overview (totals, breakdowns, limits) and Charges (every single charge, filterable). */
export const UsageSection: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [params, setParams] = useSearchParams();
  const tab: UsageTab = params.get(TAB_PARAM) === UsageTabs.CHARGES ? UsageTabs.CHARGES : UsageTabs.OVERVIEW;
  const setTab = (v: string) =>
    setParams(
      (p) => {
        if (v === UsageTabs.OVERVIEW) p.delete(TAB_PARAM);
        else p.set(TAB_PARAM, v);
        return p;
      },
      { replace: true },
    );
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value={UsageTabs.OVERVIEW}>Overview</TabsTrigger>
        <TabsTrigger value={UsageTabs.CHARGES}>Charges</TabsTrigger>
      </TabsList>
      <TabsContent value={UsageTabs.OVERVIEW} className="mt-4">
        <UsageOverviewTab isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value={UsageTabs.CHARGES} className="mt-4">
        <UsageChargesTab isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
};

const lastMonths = (n: number) =>
  Array.from({ length: n }).map((_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

const UsageOverviewTab: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const { data, isPending } = useUsage(period);
  const months = useMemo(() => lastMonths(6), []);
  if (isPending || !data) return <SettingsSkeleton />;
  const orgLimit = data.limits.find((l) => l.scope === UsageLimitScopes.ORGANIZATION);
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Usage overview"
        actions={
          <Select value={period ?? months[0]} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[130px]" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-4">
          <div className="rounded-md bg-primary-soft p-3">
            <p className="text-xs font-semibold text-accent-foreground">Total</p>
            <p className="text-2xl font-extrabold text-ink">{formatMoney(data.total_cost)}</p>
          </div>
          {data.by_kind.map((k) => (
            <div key={k.kind} className="rounded-md bg-surface-sunken p-3">
              <p className="text-xs font-semibold text-muted-foreground">{getDropdownOptionLabel(UsageKindOptions, k.kind, k.kind)}</p>
              <p className="text-lg font-bold text-ink">{formatMoney(k.cost)}</p>
            </div>
          ))}
          {orgLimit && (
            <div className="rounded-md bg-surface-sunken p-3">
              <p className="text-xs font-semibold text-muted-foreground">Monthly limit</p>
              <p className="text-lg font-bold text-ink">{formatMoney(orgLimit.monthly_limit)}</p>
            </div>
          )}
        </div>
        {data.by_day.length > 0 && (
          <div className="h-56 w-full py-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_day.map((d) => ({ day: d.day.slice(5, 10), cost: Number(d.cost.toFixed(4)) }))}>
                <CartesianGrid vertical={false} stroke="var(--hairline)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-text)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-text)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)" }} />
                <Bar dataKey="cost" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SettingsCard>
      <div className="grid gap-4 lg:grid-cols-3">
        <SettingsCard title="By member">
          <ul className="divide-y divide-hairline">
            {data.by_member.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2.5">
                <PersonAvatar name={r.user?.name} email={r.user?.email} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm">{r.user?.name ?? r.user?.email ?? "System"}</span>
                <span className="text-sm font-bold">{formatMoney(r.cost)}</span>
              </li>
            ))}
            {!data.by_member.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}
          </ul>
        </SettingsCard>
        <SettingsCard title="By bot">
          <ul className="divide-y divide-hairline">
            {data.by_bot.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2.5">
                {r.bot ? <BotAvatar seed={r.bot.avatar_seed} color={r.bot.color} size={24} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm">{r.bot?.name ?? "Other"}</span>
                <span className="text-sm font-bold">{formatMoney(r.cost)}</span>
              </li>
            ))}
            {!data.by_bot.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}
          </ul>
        </SettingsCard>
        <SettingsCard title="By model">
          <ul className="divide-y divide-hairline">
            {data.by_model.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{r.model?.name ?? "Other"}</span>
                <span className="text-sm font-bold">{formatMoney(r.cost)}</span>
              </li>
            ))}
            {!data.by_model.length && <li className="py-3 text-sm text-muted-foreground">No usage yet.</li>}
          </ul>
        </SettingsCard>
      </div>
      {isAdmin && <UsageLimitsCard data={data} />}
    </div>
  );
};

type UsageLimit = UsageOverview["limits"][number];

const UsageLimitsCard: FC<{ data: UsageOverview }> = ({ data }) => {
  const setLimit = useSetUsageLimit();
  const [limitScope, setLimitScope] = useState<UsageLimitScope>(UsageLimitScopes.ORGANIZATION);
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: members } = useMembers();
  const { data: bots } = useBots();
  return (
    <SettingsCard title="Monthly usage limits" description="Alerts at 80% and 100%. Bots pause when a limit is reached.">
      <ul className="divide-y divide-hairline">
        {data.limits.map((l) => (
          <UsageLimitRow
            key={l.id}
            limit={l}
            data={data}
            member={members?.find((m) => m.user.id === l.user_id)?.user}
            bot={bots?.find((b) => b.id === l.bot_id)}
            editing={editingId === l.id}
            onEdit={() => setEditingId(l.id)}
            onDone={() => setEditingId(null)}
          />
        ))}
        {!data.limits.length && <li className="py-3 text-sm text-muted-foreground">No limits set.</li>}
      </ul>
      <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap">
        <Select
          value={limitScope}
          onValueChange={(v) => {
            setLimitScope(v as UsageLimitScope);
            setTarget("");
          }}
        >
          <SelectTrigger className="sm:w-[180px]" aria-label="Limit scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(UsageLimitScopes).map((v) => (
              <SelectItem key={v} value={v}>
                {getDropdownOptionLabel(UsageLimitScopeOptions, v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {limitScope !== UsageLimitScopes.ORGANIZATION && (
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="sm:w-[220px]" aria-label={limitScope === UsageLimitScopes.MEMBER ? "Member" : "Bot"}>
              <SelectValue placeholder={limitScope === UsageLimitScopes.MEMBER ? "Choose a member" : "Choose a bot"} />
            </SelectTrigger>
            <SelectContent>
              {limitScope === UsageLimitScopes.MEMBER
                ? (members ?? []).map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                    </SelectItem>
                  ))
                : (bots ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <BotAvatar seed={b.avatar_seed} color={b.color} size={24} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        )}
        <Input inputMode="decimal" placeholder="USD per month" value={amount} onChange={(e) => setAmount(e.target.value)} className="sm:w-[160px]" aria-label="Amount" />
        <Button
          disabled={!AMOUNT_RE.test(amount) || (limitScope !== UsageLimitScopes.ORGANIZATION && !target)}
          loading={setLimit.isPending}
          onClick={() =>
            setLimit.mutate(
              { scope: limitScope, user_id: limitScope === UsageLimitScopes.MEMBER ? target : undefined, bot_id: limitScope === UsageLimitScopes.BOT ? target : undefined, monthly_limit: Number(amount) },
              {
                onSuccess: () => {
                  setAmount("");
                  setTarget("");
                },
              },
            )
          }
        >
          Set limit
        </Button>
      </div>
      <p className="pt-2 text-xs text-muted-foreground">Limits are in US dollars per calendar month. Bot limits can also be set in each bot's Sharing tab.</p>
    </SettingsCard>
  );
};

interface UsageLimitRowProps {
  limit: UsageLimit;
  data: UsageOverview;
  member?: { name: string | null; email: string };
  bot?: { name: string; avatar_seed: string; color: string };
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

/** One limit with its progress bar. Edit swaps the amount for an input with Save and Cancel. */
const UsageLimitRow: FC<UsageLimitRowProps> = ({ limit: l, data, member, bot, editing, onEdit, onDone }) => {
  const setLimit = useSetUsageLimit();
  const [draft, setDraft] = useState("");
  const spent =
    l.scope === UsageLimitScopes.ORGANIZATION
      ? data.total_cost
      : l.scope === UsageLimitScopes.MEMBER
        ? (data.by_member.find((r) => r.user?.id === l.user_id)?.cost ?? 0)
        : (data.by_bot.find((r) => r.bot?.id === l.bot_id)?.cost ?? 0);
  const pct = l.monthly_limit > 0 ? Math.min(100, Math.round((spent / l.monthly_limit) * 100)) : 100;
  const label = member ? (member.name ?? member.email) : bot ? bot.name : getDropdownOptionLabel(UsageLimitScopeOptions, l.scope);
  const target = { scope: l.scope, user_id: l.user_id ?? undefined, bot_id: l.bot_id ?? undefined };
  const startEdit = () => {
    setDraft(String(l.monthly_limit));
    onEdit();
  };
  const save = () => {
    if (!AMOUNT_RE.test(draft)) return;
    if (Number(draft) === l.monthly_limit) return onDone();
    setLimit.mutate({ ...target, monthly_limit: Number(draft) }, { onSuccess: onDone });
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      {member ? <PersonAvatar name={member.name} email={member.email} size={24} /> : bot ? <BotAvatar seed={bot.avatar_seed} color={bot.color} size={24} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{label}</span>
        <span className="mt-1 block h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-sunken" aria-label={`${pct}% used`}>
          <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-error" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{formatMoney(spent)} of</span>
      {editing ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onDone()}
            className="h-9 w-[110px]"
            aria-label={`Monthly limit for ${label} in USD`}
            aria-invalid={!AMOUNT_RE.test(draft)}
          />
          <Button type="submit" size="sm" disabled={!AMOUNT_RE.test(draft)} loading={setLimit.isPending} aria-label="Save limit">
            <Check /> Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <span className="font-bold">{formatMoney(l.monthly_limit)}</span>
          <Button variant="ghost" size="sm" onClick={startEdit} aria-label={`Edit limit for ${label}`}>
            <Pencil /> Edit
          </Button>
          <Button variant="ghost" size="sm" loading={setLimit.isPending} onClick={() => setLimit.mutate({ ...target, monthly_limit: null })} aria-label={`Remove limit for ${label}`}>
            <X /> Remove
          </Button>
        </>
      )}
    </li>
  );
};

// ---------- Charges tab ----------

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date range for a quick-range choice. Custom ranges come from the date fields instead. */
const rangeDates = (r: UsageRange): { from?: string; to?: string } => {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
  switch (r) {
    case UsageRanges.THIS_MONTH:
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    case UsageRanges.LAST_7:
      return { from: ymd(daysAgo(6)), to: ymd(now) };
    case UsageRanges.LAST_30:
      return { from: ymd(daysAgo(29)), to: ymd(now) };
    case UsageRanges.LAST_MONTH:
      return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default:
      return {};
  }
};

/** Single charges are often fractions of a cent, so show more digits than the totals do. */
const formatChargeCost = (n: number) => (n === 0 ? "$0.00" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const nf = new Intl.NumberFormat();

const chargeAmount = (c: UsageCharge) => {
  if (c.kind === UsageKinds.MODEL_TOKENS || c.kind === UsageKinds.ARTIFACT_AI) {
    if (c.input_tokens != null || c.output_tokens != null) return `${nf.format(c.input_tokens ?? 0)} in · ${nf.format(c.output_tokens ?? 0)} out`;
    return `${nf.format(Math.round(c.quantity))} tokens`;
  }
  if (c.kind === UsageKinds.VOICE_MINUTES || c.kind === UsageKinds.COMPUTER_MINUTES) return `${nf.format(Number(c.quantity.toFixed(1)))} min`;
  return nf.format(c.quantity);
};

interface ChargeFilters {
  kind: string;
  range: UsageRange;
  from: string;
  to: string;
  user_id: string;
  bot_id: string;
  model_id: string;
}

const DEFAULT_FILTERS: ChargeFilters = { kind: ALL_FILTER, range: UsageRanges.THIS_MONTH, from: "", to: "", user_id: ALL_FILTER, bot_id: ALL_FILTER, model_id: ALL_FILTER };
const pick = (v: string) => (v === ALL_FILTER ? undefined : v);

const UsageChargesTab: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [filters, setFilters] = useState<ChargeFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const { data: members } = useMembers();
  const { data: bots } = useBots();
  const { data: models } = useModels();
  const set = <K extends keyof ChargeFilters>(k: K, v: ChargeFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const dates = filters.range === UsageRanges.CUSTOM ? { from: filters.from || undefined, to: filters.to || undefined } : rangeDates(filters.range);
  const { data, isPending, isFetching } = useUsageCharges({
    page,
    kind: pick(filters.kind) as UsageKind | undefined,
    user_id: isAdmin ? pick(filters.user_id) : undefined,
    bot_id: pick(filters.bot_id),
    model_id: pick(filters.model_id),
    ...dates,
  });
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const badRange = !!(dates.from && dates.to && dates.from > dates.to);

  return (
    <SettingsCard title="Charges" description={isAdmin ? "Every charge in this organisation: AI models, voice, cloud computers and more." : "Every charge from your own use: AI models, voice, cloud computers and more."}>
      <div className="grid gap-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select value={filters.range} onValueChange={(v) => set("range", v as UsageRange)}>
          <SelectTrigger aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UsageRangeOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.kind} onValueChange={(v) => set("kind", v)}>
          <SelectTrigger aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All types</SelectItem>
            {UsageKindOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={filters.user_id} onValueChange={(v) => set("user_id", v)}>
            <SelectTrigger aria-label="Member">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All members</SelectItem>
              {(members ?? []).map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  <span className="flex items-center gap-2">
                    <PersonAvatar name={m.user.name} email={m.user.email} size={24} />
                    {m.user.name ?? m.user.email}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.bot_id} onValueChange={(v) => set("bot_id", v)}>
          <SelectTrigger aria-label="Bot">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All bots</SelectItem>
            {(bots ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <span className="flex items-center gap-2">
                  <BotAvatar seed={b.avatar_seed} color={b.color} size={24} />
                  {b.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.model_id} onValueChange={(v) => set("model_id", v)}>
          <SelectTrigger aria-label="Model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All models</SelectItem>
            {(models ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.range === UsageRanges.CUSTOM && (
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} className="sm:w-[180px]" aria-label="From date" aria-invalid={badRange} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} className="sm:w-[180px]" aria-label="To date" aria-invalid={badRange} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-hairline py-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {data ? (
            <>
              <span className="font-bold text-ink">{nf.format(data.pagination.total)}</span> {data.pagination.total === 1 ? "charge" : "charges"} · <span className="font-bold text-ink">{formatMoney(data.total_cost)}</span> total
            </>
          ) : (
            " "
          )}
        </p>
        {badRange && <p className="text-sm text-error">The start date is after the end date.</p>}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <div className={cn("transition-opacity", isFetching && "opacity-60")}>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type · model</TableHead>
                  {isAdmin && <TableHead>Member</TableHead>}
                  <TableHead>Bot</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                    <TableCell>
                      <span className="block whitespace-nowrap text-sm">{getDropdownOptionLabel(UsageKindOptions, c.kind, c.kind)}</span>
                      {c.model && <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{c.model.name}</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {c.user ? (
                          <span className="flex items-center gap-2 text-sm">
                            <PersonAvatar name={c.user.name} email={c.user.email} size={24} />
                            <span className="max-w-[140px] truncate">{c.user.name ?? c.user.email}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">System</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {c.bot ? (
                        <span className="flex items-center gap-2 text-sm">
                          <BotAvatar seed={c.bot.avatar_seed} color={c.bot.color} size={24} />
                          <span className="max-w-[140px] truncate">{c.bot.name}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{chargeAmount(c)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm font-bold">{formatChargeCost(c.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y divide-hairline md:hidden">
            {data?.data.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2.5">
                {c.bot ? <BotAvatar seed={c.bot.avatar_seed} color={c.bot.color} size={32} /> : <PersonAvatar name={c.user?.name} email={c.user?.email} size={32} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {getDropdownOptionLabel(UsageKindOptions, c.kind, c.kind)}
                    {c.model ? ` · ${c.model.name}` : ""}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[c.bot?.name, isAdmin ? (c.user?.name ?? c.user?.email) : null].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {chargeAmount(c)} · {timeAgo(c.created_at)}
                  </span>
                </span>
                <span className="text-sm font-bold">{formatChargeCost(c.cost)}</span>
              </li>
            ))}
          </ul>
          {!data?.data.length && <p className="py-4 text-sm text-muted-foreground">{isFiltered ? "No charges match these filters." : "No charges yet."}</p>}
          {data && data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button variant="outline" size="sm" disabled={!data.pagination.has_prev} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {data.pagination.page} / {data.pagination.total_pages}
              </span>
              <Button variant="outline" size="sm" disabled={!data.pagination.has_next} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  );
};
