import type { FC } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutomationTriggers } from "@/features/automations/hooks/use-automations";
import type { Connection } from "@/features/connections/interfaces/connections.interfaces";

interface Props {
  connections: Connection[];
  connectionId: string;
  slug: string;
  config: Record<string, string>;
  onChange: (v: { connectionId?: string; slug?: string; config?: Record<string, string> }) => void;
  errors?: { connection?: string; slug?: string };
}

/** §10.2 "When something happens": the connected account to watch, the event and the event's settings. */
export const TriggerPicker: FC<Props> = ({ connections, connectionId, slug, config, onChange, errors }) => {
  const { data, isPending, error } = useAutomationTriggers(connectionId || null);
  const type = data?.triggers.find((t) => t.slug === slug);
  const props = Object.entries(type?.config.properties ?? {});
  const required = type?.config.required ?? [];

  return (
    <div className="space-y-3 rounded-md border border-hairline p-3">
      <div className="space-y-1.5">
        <Label htmlFor="trigger-connection">Account to watch</Label>
        <Select value={connectionId} onValueChange={(v) => onChange({ connectionId: v, slug: "", config: {} })}>
          <SelectTrigger id="trigger-connection"><SelectValue placeholder="Choose a connected account" /></SelectTrigger>
          <SelectContent>
            {connections.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label} · {c.service_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!connections.length && <p className="text-xs text-muted-foreground">Connect a service on the Connections page first.</p>}
        {errors?.connection && <p className="text-sm font-semibold text-error">{errors.connection}</p>}
      </div>
      {connectionId && (
        <div className="space-y-1.5">
          <Label htmlFor="trigger-event">When</Label>
          {isPending ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : error ? (
            <p className="text-sm text-error">{(error as Error).message}</p>
          ) : !data?.triggers.length ? (
            <p className="text-sm text-muted-foreground">{data?.connection.service_name} has no events that can start an automation.</p>
          ) : (
            <Select value={slug} onValueChange={(v) => onChange({ slug: v, config: {} })}>
              <SelectTrigger id="trigger-event"><SelectValue placeholder="Choose an event" /></SelectTrigger>
              <SelectContent>
                {data.triggers.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {type?.description && <p className="text-xs text-muted-foreground">{type.description.split("\n")[0]}</p>}
          {errors?.slug && <p className="text-sm font-semibold text-error">{errors.slug}</p>}
        </div>
      )}
      {props.map(([key, p]) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`trigger-${key}`}>
            {p.title ?? key}
            {required.includes(key) ? "" : " (optional)"}
          </Label>
          <Input id={`trigger-${key}`} value={config[key] ?? ""} placeholder={p.default !== undefined ? String(p.default) : ""} onChange={(e) => onChange({ config: { ...config, [key]: e.target.value } })} />
          {p.description && <p className="text-xs text-muted-foreground">{p.description.split("\n")[0]}</p>}
        </div>
      ))}
    </div>
  );
};
