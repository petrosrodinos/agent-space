import { useMemo, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Bot as BotIcon, Globe, History, KeyRound, Lock, MoreHorizontal, Pencil, Plug, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCredentials, useUpdateCredential } from "@/features/connections/hooks/use-connections";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { Credential } from "@/features/connections/interfaces/connections.interfaces";
import { CredentialKindOptions, CredentialStatusFilterOptions, CredentialStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { AddSecretDialog, ChooseBotsDialog, DeleteSecretDialog, HistorySheet, RenameSecretDialog, ReplaceSecretDialog } from "./components/secret-dialogs";
import { CredentialKinds, CredentialStatuses, Visibilities } from "@/features/connections/interfaces/connections.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

const SecretActions = { RENAME: "rename", REPLACE: "replace", BOTS: "bots", HISTORY: "history", DELETE: "delete", SHARE: "share" } as const;
type Action = (typeof SecretActions)[keyof typeof SecretActions];
const tone = (s: string) => (s === CredentialStatuses.ACTIVE ? "success" : s === CredentialStatuses.EXPIRED ? "warning" : "error") as "success" | "warning" | "error";

const SecretRow: FC<{ s: Credential; isAdmin: boolean; onAction: (a: Action, s: Credential) => void }> = ({ s, isAdmin, onAction }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-sticker sm:flex-row sm:items-center">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken">
        {s.kind === CredentialKinds.WEBSITE_LOGIN ? <Globe className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-ink">{s.label}</span>
          <code className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-body">{s.masked_hint ?? "••••"}</code>
          <Badge variant="secondary">{s.visibility === Visibilities.SHARED ? <><Users className="h-3 w-3" /> Shared</> : "Private"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {s.website_domain ?? s.service_name ?? "Service"} · {getDropdownOptionLabel(CredentialKindOptions, s.kind)} · added by {s.owner?.name ?? s.owner?.email ?? "someone"} {formatDate(s.created_at)}
        </p>
        <p className="text-xs text-muted-foreground">
          {s.bots.length ? `Bots: ${s.bots.map((b) => b.name).join(", ")}` : "All your bots"} · {s.last_used_at ? `last used ${timeAgo(s.last_used_at)}${s.last_used_bot ? ` by ${s.last_used_bot.name}` : ""}` : "never used"}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 self-end sm:self-center">
      <StatusPill tone={tone(s.status)}>{getDropdownOptionLabel(CredentialStatusOptions, s.status)}</StatusPill>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Actions for ${s.label}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-md p-1.5">
          <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => onAction(SecretActions.HISTORY, s)}><History className="h-4 w-4" /> History</DropdownMenuItem>
          {s.can_manage && (
            <>
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => onAction(SecretActions.RENAME, s)}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => onAction(SecretActions.REPLACE, s)}><RefreshCw className="h-4 w-4" /> {s.kind === CredentialKinds.WEBSITE_LOGIN ? "Update login" : "Replace value"}</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => onAction(SecretActions.BOTS, s)}><BotIcon className="h-4 w-4" /> Choose bots</DropdownMenuItem>
              {isAdmin && <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => onAction(SecretActions.SHARE, s)}><Users className="h-4 w-4" /> {s.visibility === Visibilities.SHARED ? "Make private" : "Share with organisation"}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 rounded-sm text-error focus:text-error" onSelect={() => onAction(SecretActions.DELETE, s)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

const SecretsPage: FC = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL_FILTER);
  const [service, setService] = useState<string>(ALL_FILTER);
  const [bot, setBot] = useState<string>(ALL_FILTER);
  const { data: secrets, isPending } = useCredentials({ search: search || undefined, status: status === ALL_FILTER ? undefined : status, service: service === ALL_FILTER ? undefined : service, bot_id: bot === ALL_FILTER ? undefined : bot });
  const { data: allSecrets } = useCredentials();
  const { data: bots } = useBots();
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const update = useUpdateCredential();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<{ a: Action; s: Credential } | null>(null);
  const services = useMemo(() => [...new Set((allSecrets ?? []).map((s) => s.service_name).filter(Boolean))] as string[], [allSecrets]);
  const mine = (secrets ?? []).filter((s) => s.visibility === Visibilities.PRIVATE);
  const shared = (secrets ?? []).filter((s) => s.visibility === Visibilities.SHARED);
  const close = () => setTarget(null);
  const pick = (a: Action) => (target?.a === a ? target.s : null);

  const section = (title: string, list: Credential[], hint?: string) => (
    <section className="mb-8">
      <h2 className="eyebrow mb-1">{title}</h2>
      {hint && <p className="mb-3 text-sm text-muted-foreground">{hint}</p>}
      <div className="space-y-3">
        {list.map((s) => <SecretRow key={s.id} s={s} isAdmin={isAdmin} onAction={(a, x) => setTarget({ a, s: x })} />)}
        {!list.length && <p className="rounded-lg border border-dashed border-hairline-strong p-4 text-sm text-muted-foreground">Nothing here.</p>}
      </div>
    </section>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Secrets"
        description="Keys, tokens and website logins you've given Agent Space. Stored encrypted, never shown again, never seen by bots."
        actions={
          <>
            <Button variant="outline" asChild><Link to={Routes.connections.root}><Plug /> Connections</Link></Button>
            <Button onClick={() => setAdding(true)}><Plus /> Add secret</Button>
          </>
        }
      />
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search secrets" />
        </div>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger aria-label="Filter by service"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All services</SelectItem>
            {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>{CredentialStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={bot} onValueChange={setBot}>
          <SelectTrigger aria-label="Filter by bot"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All bots</SelectItem>
            {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.emoji} {b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isPending ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : !allSecrets?.length ? (
        <EmptyState
          title="No secrets yet"
          description="When you give a bot an API key — here or with the secure secret box in chat — it shows up here."
          stickers={[{ icon: Lock, color: "#4A4560" }, { icon: KeyRound, color: "#6B4EFF" }, { icon: ShieldCheck, color: "#17B5B0" }]}
          action={<Button size="lg" onClick={() => setAdding(true)}><KeyRound /> Add a secret</Button>}
        />
      ) : (
        <>
          {section("My secrets", mine)}
          {section("Organisation secrets", shared, isAdmin ? "Shared with every member's bots. Owners and Admins can manage them." : "Shared by Owners and Admins. You can see them but not change them.")}
        </>
      )}

      <AddSecretDialog open={adding} isAdmin={isAdmin} onClose={() => setAdding(false)} />
      <RenameSecretDialog secret={pick(SecretActions.RENAME)} onClose={close} />
      <ReplaceSecretDialog secret={pick(SecretActions.REPLACE)} onClose={close} />
      <ChooseBotsDialog secret={pick(SecretActions.BOTS)} isAdmin={isAdmin} onClose={close} />
      <DeleteSecretDialog secret={pick(SecretActions.DELETE)} onClose={close} />
      <HistorySheet secret={pick(SecretActions.HISTORY)} onClose={close} />
      <ConfirmationDialog
        isOpen={target?.a === SecretActions.SHARE}
        onClose={close}
        title={target?.s.visibility === Visibilities.SHARED ? "Make this secret private?" : "Share with the organisation?"}
        description={target?.s.visibility === Visibilities.SHARED ? "Other members' bots will lose access to it immediately." : "Every member's bots will be able to use it (never see it)."}
        confirmText={target?.s.visibility === Visibilities.SHARED ? "Make private" : "Share"}
        isLoading={update.isPending}
        onConfirm={() => target && update.mutate({ id: target.s.id, visibility: target.s.visibility === Visibilities.SHARED ? Visibilities.PRIVATE : Visibilities.SHARED }, { onSuccess: close })}
      />
    </PageContainer>
  );
};

export default SecretsPage;
