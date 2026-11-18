import { useEffect, useState, type FC } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCredential } from "@/features/connections/hooks/use-connections";
import { SecretKinds } from "@/features/conversations/interfaces/conversations.interfaces";

interface Props {
  open: boolean;
  secret: string;
  service: string;
  botIds: string[];
  onCancel: () => void;
  onSendAnyway: () => void;
  onStored: (label: string, hint: string) => void;
}

/**
 * §8.8 "This looks like a secret. Store it securely instead?" — Store securely (default) removes the secret from the message,
 * saves it through the secrets endpoint, and sends the rest as normal. "Send anyway" exists only for false positives.
 */
export const StoreSecretDialog: FC<Props> = ({ open, secret, service, botIds, onCancel, onSendAnyway, onStored }) => {
  const create = useCreateCredential();
  const [label, setLabel] = useState("");
  const [svc, setSvc] = useState(service);
  useEffect(() => {
    if (open) {
      setSvc(service);
      setLabel(service ? `${service} key` : "My key");
    }
  }, [open, service]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !create.isPending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> This looks like a secret
          </DialogTitle>
          <DialogDescription>Store it securely instead? The bot will be able to use it without ever seeing it, and it won't appear in the chat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-[14px] bg-surface-sunken px-3 py-2 font-mono text-sm text-body">{secret.slice(0, 6)}…{secret.slice(-4)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="store-secret-label">Name</Label>
              <Input id="store-secret-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="store-secret-service">Service</Label>
              <Input id="store-secret-service" value={svc} onChange={(e) => setSvc(e.target.value)} placeholder="e.g. Mailchimp" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onSendAnyway} disabled={create.isPending}>
            Send anyway
          </Button>
          <Button
            autoFocus
            loading={create.isPending}
            disabled={!label.trim()}
            onClick={() => create.mutate({ label: label.trim(), service_name: svc.trim() || undefined, kind: SecretKinds.API_KEY, value: secret, bot_ids: botIds }, { onSuccess: (c) => onStored(c.label, c.masked_hint ?? "") })}
          >
            <Lock /> Store securely
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
