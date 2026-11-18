import { Monitor } from "lucide-react";
import type { FC } from "react";
import { cn } from "@/lib/utils";
import { ApprovalPreviewKinds } from "@/features/conversations/interfaces/conversations.interfaces";
import { DEFAULT_SKILL_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";

interface Change {
  field: string;
  to: string;
}

const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function renderValue(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "string") return <span className="whitespace-pre-wrap break-words">{v}</span>;
  if (typeof v === "number" || typeof v === "boolean") return <span>{String(v)}</span>;
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return <span>{(v as string[]).join(", ")}</span>;
  return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-surface/70 p-2 font-mono text-[12px]">{JSON.stringify(v, null, 2)}</pre>;
}

/**
 * The exact preview shown on an approval card (§11) — e.g. the email that will be sent, or the settings that will change.
 * Presentational only; secrets are never part of a preview.
 */
export const ApprovalPreviewBody: FC<{ preview: Record<string, any>; className?: string }> = ({ preview, className }) => {
  const kind = preview?.kind;
  if (kind === ApprovalPreviewKinds.CHANGE) {
    const changes = (preview.changes ?? []) as Change[];
    return (
      <div className={cn("space-y-2", className)}>
        <dl className="divide-y divide-[rgba(28,22,51,0.08)] overflow-hidden rounded-md bg-surface/80">
          {changes.map((c) => (
            <div key={c.field} className="grid grid-cols-[minmax(90px,140px)_1fr] gap-3 px-3 py-2 text-sm">
              <dt className="font-bold text-ink">{pretty(c.field)}</dt>
              <dd className="min-w-0 text-body">{renderValue(c.to)}</dd>
            </div>
          ))}
        </dl>
        {preview.warning && <p className="text-[13px] font-semibold text-warning">{preview.warning}</p>}
      </div>
    );
  }
  if (kind === ApprovalPreviewKinds.SKILL) {
    return (
      <div className={cn("space-y-2 rounded-md bg-surface/80 p-3 text-sm", className)}>
        <p className="font-bold text-ink">
          {preview.emoji ?? DEFAULT_SKILL_EMOJI} {preview.name}
        </p>
        <p className="text-body">{preview.description}</p>
        {preview.instructions && <p className="max-h-40 overflow-auto whitespace-pre-wrap text-[13px] text-muted-foreground">{preview.instructions}</p>}
        {Array.isArray(preview.assign_to_bots) && preview.assign_to_bots.length > 0 && <p className="text-[13px] text-muted-foreground">Give to: {preview.assign_to_bots.join(", ")}</p>}
      </div>
    );
  }
  if (kind === ApprovalPreviewKinds.CONSULT) {
    return (
      <div className={cn("rounded-md bg-surface/80 p-3 text-sm", className)}>
        <p className="text-body">
          <strong className="text-ink">{preview.from}</strong> wants to ask <strong className="text-ink">{preview.to}</strong>:
        </p>
        <p className="mt-1 italic text-body">“{preview.question}”</p>
      </div>
    );
  }
  if (kind === ApprovalPreviewKinds.COMPUTER) {
    return (
      <div className={cn("space-y-2 rounded-md bg-surface/80 p-3 text-sm", className)}>
        <p className="flex items-center gap-1.5 font-bold text-ink"><Monitor className="h-4 w-4 shrink-0" /> {preview.description}</p>
        {preview.screenshot && <img src={preview.screenshot} alt="The cloud computer's screen right now" className="w-full rounded-sm border border-hairline" />}
        <p className="text-[13px] text-muted-foreground">On the bot's cloud computer. Nothing happens until you approve.</p>
      </div>
    );
  }
  // Tool call: show account + every input field (e.g. to / subject / body of an email).
  const input = (preview?.input ?? {}) as Record<string, unknown>;
  return (
    <div className={cn("space-y-2", className)}>
      {(preview?.account || preview?.service) && (
        <p className="text-[13px] text-muted-foreground">
          Using <strong className="text-ink">{preview.account ?? preview.service}</strong>
          {preview.account_identifier ? ` (${preview.account_identifier})` : ""}
        </p>
      )}
      <dl className="divide-y divide-[rgba(28,22,51,0.08)] overflow-hidden rounded-md bg-surface/80">
        {Object.entries(input).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(80px,130px)_1fr] gap-3 px-3 py-2 text-sm">
            <dt className="font-bold text-ink">{pretty(k)}</dt>
            <dd className="min-w-0 text-body">{renderValue(v)}</dd>
          </div>
        ))}
        {Object.keys(input).length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No details</div>}
      </dl>
    </div>
  );
};
