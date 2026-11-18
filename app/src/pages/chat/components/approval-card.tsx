import { useState, type FC } from "react";
import { CheckCircle2, Hand, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ApprovalPreviewBody } from "@/components/ui/approval-preview";
import { StatusPill } from "@/components/ui/status-pill";
import { useResolveApproval } from "@/features/tasks/hooks/use-tasks";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ApprovalStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { ActionTypeOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { cn } from "@/lib/utils";
import { ApprovalStatuses, APPROVED_STATUSES, ApprovalDecisions, type ApprovalDecision } from "@/features/tasks/interfaces/tasks.interfaces";

interface ApprovalPart {
  approval_id: string;
  title: string;
  action_type: string;
  preview: Record<string, any>;
  status: string;
  requires_tap?: boolean;
}

/**
 * The one place playfulness steps back (DESIGN.MD): warning-soft card, sunshine border, the exact preview, and
 * Approve / Edit / Reject. "Edit" lets the user change the tool input before approving.
 */
export const ApprovalCard: FC<{ part: ApprovalPart; canAnswer: boolean }> = ({ part, canAnswer }) => {
  const resolve = useResolveApproval();
  const [editing, setEditing] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const input = (part.preview?.input ?? {}) as Record<string, unknown>;
  const editable = Object.entries(input).filter(([, v]) => typeof v === "string" || typeof v === "number");
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(editable.map(([k, v]) => [k, String(v)])));
  const status = resolved ?? part.status;
  const pending = status === ApprovalStatuses.PENDING;

  const answer = (decision: ApprovalDecision, edited?: Record<string, unknown>) =>
    resolve.mutate({ id: part.approval_id, decision, edited_input: edited }, { onSuccess: (a) => setResolved(a.status) });

  return (
    <section
      className={cn("my-2 rounded-lg border-[1.5px] p-4 sm:p-5", pending ? "animate-wiggle border-sunshine bg-warning-soft shadow-sticker-strong" : "border-hairline bg-surface-soft")}
      aria-label="Approval request"
      role={pending ? "alert" : undefined}
    >
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <Hand className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-snug text-ink">{part.title}</p>
          <p className="text-[13px] text-muted-foreground">{getDropdownOptionLabel(ActionTypeOptions, part.action_type, "Needs your OK")}</p>
        </div>
        {!pending && (
          <StatusPill tone={APPROVED_STATUSES.includes(status) ? "success" : status === ApprovalStatuses.REJECTED ? "error" : "neutral"}>{getDropdownOptionLabel(ApprovalStatusOptions, status, status)}</StatusPill>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 rounded-md bg-surface p-3">
          {editable.map(([k]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`ap-${part.approval_id}-${k}`}>{k.replace(/_/g, " ")}</Label>
              {(draft[k] ?? "").length > 60 ? (
                <Textarea id={`ap-${part.approval_id}-${k}`} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className="min-h-[120px]" />
              ) : (
                <Input id={`ap-${part.approval_id}-${k}`} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <ApprovalPreviewBody preview={part.preview} />
      )}

      {pending && canAnswer && (
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button onClick={() => answer(ApprovalDecisions.APPROVE, draft)} loading={resolve.isPending}>
                <CheckCircle2 /> Approve with changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={resolve.isPending}>
                Cancel edit
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => answer(ApprovalDecisions.APPROVE)} loading={resolve.isPending}>
                <CheckCircle2 /> Approve
              </Button>
              {editable.length > 0 && (
                <Button variant="outline" onClick={() => setEditing(true)} disabled={resolve.isPending}>
                  <Pencil /> Edit
                </Button>
              )}
              <Button variant="ghost" onClick={() => answer(ApprovalDecisions.REJECT)} disabled={resolve.isPending}>
                <XCircle /> Reject
              </Button>
            </>
          )}
        </div>
      )}
      {pending && !canAnswer && <p className="mt-3 text-[13px] text-muted-foreground">Waiting for the person who asked to approve.</p>}
    </section>
  );
};
