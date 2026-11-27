import { useState, type FC } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Area, AreaChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { AlertTriangle, CheckCircle2, Circle, Info, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Markdown } from "@/components/ui/markdown";
import type { UiBlock } from "@/features/conversations/interfaces/conversations.interfaces";
import { cn } from "@/lib/utils";
import { ChartKinds, FormFieldTypes, StatTrends, UiBlockTypes } from "@/features/conversations/interfaces/conversations.interfaces";

const CHART_COLORS = ["#6B4EFF", "#FF7A3D", "#1FC98E", "#38B6FF", "#FF5FAE", "#FFC83D", "#17B5B0", "#B18CFF"];

export interface UiActionHandler {
  (componentId: string, payload: Record<string, unknown>): void;
}

interface BlockProps {
  block: UiBlock;
  onAction: UiActionHandler;
  disabled?: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

const ChartBlock: FC<{ block: UiBlock }> = ({ block }) => {
  const data = Array.isArray(block.data) ? block.data.slice(0, 200) : [];
  const x = block.x ?? Object.keys(data[0] ?? {})[0];
  const series: string[] = Array.isArray(block.series) && block.series.length ? block.series : Object.keys(data[0] ?? {}).filter((k) => k !== x && typeof data[0]?.[k] === "number");
  const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
  const tooltip = <Tooltip contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)", background: "var(--popover)", color: "var(--ink)", boxShadow: "var(--sh-pop)" }} />;
  return (
    <div className="h-64 w-full" role="img" aria-label={block.title ?? "Chart"}>
      {block.title && <p className="mb-2 text-sm font-bold text-ink">{block.title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        {block.kind === ChartKinds.PIE ? (
          <PieChart>
            <Pie data={data} dataKey={series[0]} nameKey={x} innerRadius="45%" outerRadius="80%" paddingAngle={2}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            {tooltip}
            <Legend />
          </PieChart>
        ) : block.kind === ChartKinds.LINE ? (
          <LineChart data={data}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} width={40} />
            {tooltip}
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Line key={s} dataKey={s} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={false} />
            ))}
          </LineChart>
        ) : block.kind === ChartKinds.AREA ? (
          <AreaChart data={data}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} width={40} />
            {tooltip}
            {series.map((s, i) => (
              <Area key={s} dataKey={s} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} width={40} />
            {tooltip}
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const FormBlock: FC<BlockProps> = ({ block, onAction, disabled }) => {
  const fields: any[] = Array.isArray(block.fields) ? block.fields : [];
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map((f) => [f.name, f.type === FormFieldTypes.CHECKBOX ? false : (f.default ?? "")])));
  const [submitted, setSubmitted] = useState(false);
  const missing = fields.filter((f) => f.required && (values[f.name] === "" || values[f.name] === undefined));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing.length) return;
        onAction(block.id ?? "form", values);
        setSubmitted(true);
      }}
    >
      {block.title && <p className="font-bold text-ink">{block.title}</p>}
      {fields.map((f) => {
        const id = `${block.id}-${f.name}`;
        return (
          <div key={f.name} className="space-y-1.5">
            {f.type !== FormFieldTypes.CHECKBOX && (
              <Label htmlFor={id}>
                {f.label ?? f.name}
                {f.required && <span className="text-error"> *</span>}
              </Label>
            )}
            {f.type === FormFieldTypes.TEXTAREA ? (
              <Textarea dictation id={id} placeholder={f.placeholder} value={str(values[f.name])} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} disabled={disabled || submitted} />
            ) : f.type === FormFieldTypes.SELECT ? (
              <Select value={str(values[f.name]) || undefined} onValueChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))} disabled={disabled || submitted}>
                <SelectTrigger id={id} aria-label={f.label ?? f.name}>
                  <SelectValue placeholder={f.placeholder ?? "Choose…"} />
                </SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).filter((o: unknown) => str(o)).map((o: unknown) => (
                    <SelectItem key={str(o)} value={str(o)}>
                      {str(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === FormFieldTypes.CHECKBOX ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!values[f.name]} onCheckedChange={(c) => setValues((v) => ({ ...v, [f.name]: !!c }))} disabled={disabled || submitted} />
                {f.label ?? f.name}
              </label>
            ) : (
              <Input id={id} type={([FormFieldTypes.NUMBER, FormFieldTypes.EMAIL, FormFieldTypes.DATE] as string[]).includes(f.type) ? f.type : FormFieldTypes.TEXT} placeholder={f.placeholder} value={str(values[f.name])} onChange={(e) => setValues((v) => ({ ...v, [f.name]: f.type === "number" ? e.target.valueAsNumber : e.target.value }))} disabled={disabled || submitted} />
            )}
          </div>
        );
      })}
      <Button type="submit" disabled={disabled || submitted || missing.length > 0}>
        {submitted ? "Submitted" : (block.submit_label ?? "Submit")}
      </Button>
    </form>
  );
};

const ChecklistBlock: FC<BlockProps> = ({ block, onAction, disabled }) => {
  const [items, setItems] = useState<any[]>(Array.isArray(block.items) ? block.items : []);
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 rounded-md px-1 py-1">
          <Checkbox
            checked={!!it.done}
            disabled={disabled}
            aria-label={str(it.label)}
            onCheckedChange={(c) => {
              const next = items.map((x, j) => (j === i ? { ...x, done: !!c } : x));
              setItems(next);
              onAction(block.id ?? "checklist", { item: str(it.label), done: !!c });
            }}
            className="mt-0.5"
          />
          <span className={cn("flex-1 text-[15px]", it.done && "text-muted-foreground line-through")}>{str(it.label)}</span>
          {(it.owner || it.due) && <span className="shrink-0 text-xs text-muted-foreground">{[it.owner, it.due].filter(Boolean).join(" · ")}</span>}
        </li>
      ))}
    </ul>
  );
};

export const UiBlockView: FC<BlockProps> = ({ block, onAction, disabled }) => {
  switch (block.type) {
    case UiBlockTypes.HEADING:
      return <h3 className="text-[17px] font-bold text-ink">{str(block.text)}</h3>;
    case UiBlockTypes.TEXT:
      return <Markdown>{str(block.markdown ?? block.text)}</Markdown>;
    case UiBlockTypes.DIVIDER:
      return <hr className="border-hairline" />;
    case UiBlockTypes.CARD:
      return (
        <div className="rounded-md border border-hairline bg-surface-soft p-4">
          {block.title && <p className="font-bold text-ink">{str(block.title)}</p>}
          {block.body && <Markdown className="mt-1 text-body">{str(block.body)}</Markdown>}
          {block.footer && <p className="mt-2 text-xs text-muted-foreground">{str(block.footer)}</p>}
        </div>
      );
    case UiBlockTypes.STATS:
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
          {(block.items ?? []).map((s: any, i: number) => (
            <div key={i} className="rounded-md bg-surface-sunken p-3">
              <p className="text-xs font-semibold text-muted-foreground">{str(s.label)}</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{str(s.value)}</p>
              {s.delta && (
                <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs font-bold", s.trend === StatTrends.DOWN ? "text-error" : "text-success")}>
                  {s.trend === StatTrends.DOWN ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {str(s.delta)}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    case UiBlockTypes.TABLE: {
      const columns: string[] = Array.isArray(block.columns) ? block.columns.map(str) : [];
      const rows: unknown[][] = Array.isArray(block.rows) ? block.rows : [];
      return (
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-bold text-ink">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i} className="border-t border-hairline">
                  {(Array.isArray(r) ? r : columns.map((c) => (r as any)?.[c])).map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-body">
                      {str(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case UiBlockTypes.CHART:
      return <ChartBlock block={block} />;
    case UiBlockTypes.LIST: {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("space-y-1 pl-5 text-[15px] text-body", block.ordered ? "list-decimal" : "list-disc")}>
          {(block.items ?? []).map((it: unknown, i: number) => (
            <li key={i}>{str(it)}</li>
          ))}
        </Tag>
      );
    }
    case UiBlockTypes.CHECKLIST:
      return <ChecklistBlock block={block} onAction={onAction} disabled={disabled} />;
    case UiBlockTypes.PROGRESS: {
      const max = Number(block.max) || 100;
      const value = Math.min(max, Number(block.value) || 0);
      return (
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-ink">{str(block.label)}</span>
            <span className="text-muted-foreground">{Math.round((value / max) * 100)}%</span>
          </div>
          <Progress value={(value / max) * 100} />
        </div>
      );
    }
    case UiBlockTypes.BUTTONS:
      return (
        <div className="flex flex-wrap gap-2">
          {(block.actions ?? []).map((a: any, i: number) => (
            <Button key={i} variant={i === 0 ? "default" : "outline"} size="sm" disabled={disabled} onClick={() => onAction(block.id ?? "buttons", { value: a.value ?? a.label, label: a.label })}>
              {str(a.label)}
            </Button>
          ))}
        </div>
      );
    case UiBlockTypes.FORM:
      return <FormBlock block={block} onAction={onAction} disabled={disabled} />;
    case UiBlockTypes.TABS: {
      const tabs: any[] = Array.isArray(block.tabs) ? block.tabs : [];
      if (!tabs.length) return null;
      return (
        <Tabs defaultValue="0">
          <TabsList className="max-w-full overflow-x-auto">
            {tabs.map((t, i) => (
              <TabsTrigger key={i} value={String(i)}>
                {str(t.label)}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t, i) => (
            <TabsContent key={i} value={String(i)} className="mt-3 space-y-3">
              {(t.blocks ?? []).map((b: UiBlock, j: number) => (
                <UiBlockView key={j} block={b} onAction={onAction} disabled={disabled} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      );
    }
    case UiBlockTypes.IMAGE:
      return /^https:\/\//.test(str(block.url)) ? <img src={str(block.url)} alt={str(block.alt)} className="max-h-80 rounded-md object-cover" loading="lazy" referrerPolicy="no-referrer" /> : null;
    case UiBlockTypes.KV:
      return (
        <dl className="divide-y divide-hairline rounded-md border border-hairline">
          {(block.items ?? []).map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-[minmax(100px,40%)_1fr] gap-3 px-3 py-2 text-sm">
              <dt className="font-semibold text-muted-foreground">{str(it.label)}</dt>
              <dd className="text-ink">{str(it.value)}</dd>
            </div>
          ))}
        </dl>
      );
    case UiBlockTypes.CALLOUT: {
      const tone = (block.tone ?? "info") as "info" | "success" | "warning" | "error";
      const Icon = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle }[tone] ?? Circle;
      return (
        <div className={cn("flex gap-2.5 rounded-md p-3 text-sm", { info: "bg-info-soft", success: "bg-success-soft", warning: "bg-warning-soft", error: "bg-error-soft" }[tone])}>
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", { info: "text-info", success: "text-success", warning: "text-warning", error: "text-error" }[tone])} />
          <Markdown className="text-sm">{str(block.text)}</Markdown>
        </div>
      );
    }
    default:
      return null;
  }
};
