import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { useCancelSecretRequest, useCreateCredential, useReplaceCredential } from "@/features/connections/hooks/use-connections";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";
import { useAuthStore } from "@/stores/auth";
import { Routes } from "@/routes/routes";
import { MessagePartTypes, SecretInputStatuses, SecretKinds } from "@/features/conversations/interfaces/conversations.interfaces";
import { Visibilities, type Visibility } from "@/features/connections/interfaces/connections.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

type SecretPart = Extract<MessagePart, { type: typeof MessagePartTypes.SECRET_INPUT }>;

const VISIBILITY = [
  { id: Visibilities.PRIVATE, label: "Private" },
  { id: Visibilities.SHARED, label: "Shared with the organisation" },
] as const;

/**
 * §8.8 secure secret box. The value is posted straight to the API's credentials endpoint — never into the chat stream,
 * messages or the model. Others in a group only see "X is adding a secret".
 */
export const SecretInputCard: FC<{ part: SecretPart }> = ({ part }) => {
  const me = useAuthStore((s) => s.user);
  const { data: org } = useCurrentOrganization();
  const { data: bots } = useBots();
  const create = useCreateCredential();
  const replace = useReplaceCredential();
  const cancel = useCancelSecretRequest();
  const [label, setLabel] = useState(part.suggested_label ?? "");
  const [service, setService] = useState(part.service ?? "");
  const [value, setValue] = useState("");
  const [website, setWebsite] = useState(part.website ?? "");
  const [username, setUsername] = useState("");
  const [totp, setTotp] = useState("");
  const [show, setShow] = useState(false);
  const isLogin = part.kind === SecretKinds.WEBSITE_LOGIN;
  const [botIds, setBotIds] = useState<string[]>([part.bot_id]);
  const [visibility, setVisibility] = useState<Visibility>(Visibilities.PRIVATE);
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const request = { run_id: part.run_id, request_id: part.request_id };

  if (part.status === SecretInputStatuses.SAVED && part.saved) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm shadow-sticker">
        <Lock className="h-4 w-4 text-success" />
        <span className="font-semibold text-ink">Saved: {part.saved.label}</span>
        <code className="rounded-xs bg-surface-sunken px-1.5 text-xs">{part.saved.masked_hint}</code>
        <Link to={Routes.secrets} className="text-xs font-bold text-primary hover:underline">
          Manage
        </Link>
      </div>
    );
  }
  if (part.status === SecretInputStatuses.CANCELLED) return <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Secret request cancelled.</p>;
  if (part.redacted || part.for_user_id !== me?.id) return <p className="my-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> {part.for_user_name} is adding a secret…</p>;

  const saving = create.isPending || replace.isPending;
  const clear = () => {
    setValue("");
    setTotp("");
  };
  const canSave = isLogin ? !!value && (!!part.replace_credential_id || (!!label.trim() && !!website.trim() && !!username.trim())) : !!value.trim() && (!!part.replace_credential_id || !!label.trim());
  const submit = () => {
    if (!canSave) return;
    if (part.replace_credential_id) replace.mutate({ id: part.replace_credential_id, value, ...(isLogin ? { username: username || undefined, totp_secret: totp || undefined } : {}), request }, { onSuccess: clear });
    else if (isLogin) create.mutate({ label, service_name: service || undefined, kind: SecretKinds.WEBSITE_LOGIN, value, website, username, totp_secret: totp || undefined, visibility, bot_ids: botIds, request }, { onSuccess: clear });
    else create.mutate({ label, service_name: service || undefined, kind: part.kind === SecretKinds.MCP_TOKEN ? SecretKinds.MCP_TOKEN : SecretKinds.API_KEY, value, visibility, bot_ids: botIds, request }, { onSuccess: clear });
  };

  return (
    <section className="my-2 rounded-lg border-[1.5px] border-primary/40 bg-surface p-4 shadow-sticker-strong sm:p-5" aria-label="Secure secret box">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          {isLogin ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <div>
          <p className="font-bold text-ink">{isLogin ? (part.replace_credential_id ? "Update a website login securely" : "Save a website login securely") : part.replace_credential_id ? "Replace a secret securely" : "Add a secret securely"}</p>
          <p className="text-[13px] text-muted-foreground">{part.purpose}</p>
        </div>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        autoComplete="off"
      >
        {!part.replace_credential_id && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`sec-name-${part.request_id}`}>Name</Label>
              <Input id={`sec-name-${part.request_id}`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </div>
            {isLogin ? (
              <div className="space-y-1">
                <Label htmlFor={`sec-site-${part.request_id}`}>Website</Label>
                <Input id={`sec-site-${part.request_id}`} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="portal.acme.com" inputMode="url" spellCheck={false} maxLength={253} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor={`sec-svc-${part.request_id}`}>Service</Label>
                <Input id={`sec-svc-${part.request_id}`} value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Mailchimp" maxLength={60} />
              </div>
            )}
          </div>
        )}
        {isLogin && (
          <div className="space-y-1">
            <Label htmlFor={`sec-user-${part.request_id}`}>{part.replace_credential_id ? "New username (optional)" : "Username or email"}</Label>
            <Input id={`sec-user-${part.request_id}`} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} maxLength={320} data-1p-ignore />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`sec-val-${part.request_id}`}>{isLogin ? "Password" : "Secret"}</Label>
          <div className="relative">
            <Input
              id={`sec-val-${part.request_id}`}
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isLogin ? "" : "Paste the key or token"}
              className="pr-11 font-mono"
              autoComplete="new-password"
              spellCheck={false}
              data-1p-ignore
            />
            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide secret" : "Show secret"}>
              {show ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isLogin ? "Stored encrypted and only typed into this website on the bot's cloud computer. The bot never sees it." : "Stored encrypted. The bot never sees it — only its name and last 4 characters."}
          </p>
        </div>
        {isLogin && (
          <div className="space-y-1">
            <Label htmlFor={`sec-totp-${part.request_id}`}>Authenticator setup key (optional)</Label>
            <Input id={`sec-totp-${part.request_id}`} type="password" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="Setup key or otpauth:// link" className="font-mono" autoComplete="off" spellCheck={false} data-1p-ignore />
            <p className="text-xs text-muted-foreground">Lets the bot enter two-step codes from an authenticator app. Codes sent by text or email still need you.</p>
          </div>
        )}
        {!part.replace_credential_id && (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-ink">Which bots may use it</p>
              <div className="flex flex-wrap gap-2">
                {(bots ?? []).map((b) => (
                  <label key={b.id} className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-sm">
                    <Checkbox checked={botIds.includes(b.id)} onCheckedChange={(c) => setBotIds((ids) => (c ? [...ids, b.id] : ids.filter((x) => x !== b.id)))} />
                    <BotAvatar seed={b.avatar_seed} color={b.color} size={24} />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
            {isAdmin && <SegmentedControl ariaLabel="Sharing" value={visibility} options={VISIBILITY} onChange={setVisibility} />}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" loading={saving} disabled={!canSave}>
            <Lock /> Save
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => cancel.mutate(request)}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};
