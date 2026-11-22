import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Check, MessageCircle, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { ApprovalPreviewBody } from "@/components/ui/approval-preview";
import { useResolveApproval } from "@/features/tasks/hooks/use-tasks";
import type { Approval } from "@/features/tasks/interfaces/tasks.interfaces";
import { ActionTypeOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import { ApprovalStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { ApprovalStatuses, APPROVED_STATUSES, ApprovalDecisions } from "@/features/tasks/interfaces/tasks.interfaces";
import { ApprovalPreviewKinds } from "@/features/conversations/interfaces/conversations.interfaces";

const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Approval card (DESIGN.MD): the one place playfulness steps back — clear preview, Approve / Edit / Reject. */
export const ApprovalCard: FC<{ approval: Approval; showConversation?: boolean }> = ({ approval, showConversation = true }) => {
  const resolve = useResolveApproval();
  const preview = approval.preview as Record<string, any>;
  const editableInput = preview?.kind === ApprovalPreviewKinds.TOOL && preview.input && typeof preview.input === "object" ? (preview.input as Record<string, unknown>) : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const pending = approval.status === ApprovalStatuses.PENDING;

  const startEdit = () => {
    setDraft(Object.fromEntries(Object.entries(editableInput ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])));
    setEditing(true);
  };

  const submitEdit = () => {
    const edited: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      const original = editableInput?.[k];
      if (typeof original === "string") edited[k] = v;
      else {
        try {
          edited[k] = JSON.parse(v);
        } catch {
          edited[k] = v;
        }
      }
    }
    resolve.mutate({ id: approval.id, decision: "approve", edited_input: edited }, { onSuccess: () => setEditing(false) });
  };

  return (
    <article className="rounded-lg border-[1.5px] border-sunshine bg-warning-soft p-5 shadow-sticker-strong">
      <div className="mb-3 flex items-start gap-3">
        <BotAvatar seed={approval.bot.avatar_seed} color={approval.bot.color} name={approval.bot.name} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold text-ink">{approval.title}</h3>
          <p className="text-xs text-muted-foreground">
            {approval.bot.name} · {getDropdownOptionLabel(ActionTypeOptions, approval.action_type, approval.action_type)} · {timeAgo(approval.created_at)}
          </p>
        </div>
        {!pending && <StatusPill tone={approval.status === ApprovalStatuses.REJECTED ? "error" : APPROVED_STATUSES.includes(approval.status) ? "success" : "neutral"}>{getDropdownOptionLabel(ApprovalStatusOptions, approval.status)}</StatusPill>}
      </div>

      {editing && editableInput ? (
        <div className="space-y-3 rounded-md bg-surface/80 p-3">
          {Object.keys(draft).map((k) => {
            const long = draft[k].length > 60 || draft[k].includes("\n");
            return (
              <div key={k}>
                <label className="mb-1 block text-sm font-bold text-ink" htmlFor={`edit-${approval.id}-${k}`}>{pretty(k)}</label>
                {long ? (
                  <Textarea id={`edit-${approval.id}-${k}`} rows={5} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                ) : (
                  <Input id={`edit-${approval.id}-${k}`} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ApprovalPreviewBody preview={preview} />
      )}

      {pending && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button loading={resolve.isPending} onClick={submitEdit}><Check /> Approve edited</Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={resolve.isPending}>Cancel</Button>
            </>
          ) : (
            <>
              <Button loading={resolve.isPending && resolve.variables?.decision === ApprovalDecisions.APPROVE} disabled={resolve.isPending} onClick={() => resolve.mutate({ id: approval.id, decision: ApprovalDecisions.APPROVE })}><Check /> Approve</Button>
              {editableInput && <Button variant="outline" disabled={resolve.isPending} onClick={startEdit}><Pencil /> Edit</Button>}
              <Button variant="ghost" loading={resolve.isPending && resolve.variables?.decision === ApprovalDecisions.REJECT} disabled={resolve.isPending} onClick={() => resolve.mutate({ id: approval.id, decision: ApprovalDecisions.REJECT })}><X /> Reject</Button>
            </>
          )}
          {showConversation && approval.conversation_id && (
            <Button variant="link" asChild className="ml-auto">
              <Link to={Routes.chat.conversation(approval.conversation_id)}><MessageCircle /> Open conversation</Link>
            </Button>
          )}
        </div>
      )}
      {approval.requires_tap && pending && <p className="mt-2 text-xs font-semibold text-warning">This action always needs a tap to approve.</p>}
    </article>
  );
};
