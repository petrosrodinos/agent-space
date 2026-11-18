import { useEffect, useState, type FC } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard } from "@/components/ui/setting-row";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useAutomationMemory, useResetAutomationMemory, useSetAutomationMemory } from "@/features/automations/hooks/use-automations";
import { formatBytes } from "@/lib/date";

/** §10.4: the automation's own memory — view, edit notes, or reset so the next run starts fresh. */
export const MemoryTab: FC<{ automationId: string; plan: string | null }> = ({ automationId, plan }) => {
  const { data, isPending } = useAutomationMemory(automationId);
  const save = useSetAutomationMemory();
  const reset = useResetAutomationMemory();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const original = JSON.stringify(data?.notes ?? {}, null, 2);

  useEffect(() => {
    if (data) setText(JSON.stringify(data.notes ?? {}, null, 2));
  }, [data]);

  const submit = () => {
    try {
      const parsed = JSON.parse(text || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Memory must be a JSON object, e.g. { \"last_report\": \"3 Nov\" }");
      setError(null);
      save.mutate({ id: automationId, notes: parsed });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (isPending) return <Skeleton className="h-72 rounded-[20px]" />;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Notes"
        description={plan ? `What it keeps: ${plan}` : "What the bot keeps between runs. It reads this at the start of each run and updates it at the end."}
        actions={<Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={!data || (data.size === 0 && !data.files.length)}><RotateCcw /> Reset</Button>}
      >
        <div className="mt-3 space-y-2">
          <Textarea aria-label="Automation memory (JSON)" rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]" spellCheck={false} />
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{formatBytes(data?.size ?? 0)} of {formatBytes(data?.max_size ?? 1024 * 1024)}</span>
            <Button onClick={submit} disabled={text === original} loading={save.isPending}>Save notes</Button>
          </div>
        </div>
      </SettingsCard>
      {!!data?.files.length && (
        <SettingsCard title="Files">
          <ul className="mt-2 divide-y divide-hairline text-sm">
            {data.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate font-semibold text-ink">{f.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
      <ConfirmationDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset memory?"
        description="The next run starts fresh, as if it had never run before."
        confirmText="Reset"
        variant="destructive"
        isLoading={reset.isPending}
        onConfirm={() => reset.mutate(automationId, { onSuccess: () => setConfirmReset(false) })}
      />
    </div>
  );
};
