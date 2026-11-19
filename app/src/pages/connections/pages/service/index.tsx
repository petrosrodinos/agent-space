import { useMemo, useState, type FC, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Pencil, Plug, Plus, Unplug } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useConnections, useDeleteConnection, useDisconnectAccounts, useServiceDetails } from "@/features/connections/hooks/use-connections";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { Connection } from "@/features/connections/interfaces/connections.interfaces";
import { ConnectionStatuses, ToolGroups } from "@/features/connections/interfaces/connections.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { Routes } from "@/routes/routes";
import { ConnectionActionsMenu, ConnectionBadges, ServiceLogo, connectionTone, useReconnectAndRedirect } from "../../components/connection-tile";
import { ConnectDialog, LimitBotsDialog, RenameConnectionDialog } from "../../components/connection-dialogs";
import { ToolPermissionsSection } from "../../components/tool-permissions-section";

const websiteUrl = (w: string) => (/^https?:\/\//.test(w) ? w : `https://${w}`);

const SectionTitle: FC<{ title: string; count?: number }> = ({ title, count }) => (
  <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
    {title}
    {count !== undefined && <span className="ml-1.5 font-normal">{count}</span>}
  </h2>
);

const Card: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker ${className ?? ""}`}>{children}</div>
);

const AccountRow: FC<{ c: Connection; isAdmin: boolean; onRename: () => void; onLimit: () => void; onDelete: () => void }> = ({ c, isAdmin, onRename, onLimit, onDelete }) => {
  const reconnect = useReconnectAndRedirect();
  return (
    <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[15px] font-bold text-ink">{c.label}</span>
          {c.can_manage && (
            <button type="button" onClick={onRename} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken hover:text-ink" aria-label={`Rename ${c.label}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <ConnectionBadges c={c} />
        </div>
        <p className="truncate text-[13px] text-muted-foreground">{c.account_identifier ?? c.owner?.email ?? c.service_name}</p>
        {c.restricted_bots.length > 0 && <p className="truncate text-xs text-muted-foreground">Only {c.restricted_bots.map((b) => b.name).join(", ")}</p>}
      </div>
      {c.status !== ConnectionStatuses.ACTIVE && c.can_manage ? (
        <Button size="sm" variant="outline" loading={reconnect.isPending} onClick={() => reconnect.run(c.id)}>
          Reconnect
        </Button>
      ) : (
        <StatusPill tone={connectionTone(c.status)}>{getDropdownOptionLabel(ConnectionStatusOptions, c.status)}</StatusPill>
      )}
      <ConnectionActionsMenu c={c} isAdmin={isAdmin} onRename={onRename} onLimit={onLimit} onDelete={onDelete} />
    </div>
  );
};

const InfoRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 text-sm last:border-b-0">
    <span className="font-semibold text-ink">{label}</span>
    <span className="min-w-0 truncate text-right text-muted-foreground">{children}</span>
  </div>
);

/** Service details (§8): accounts you've connected, every tool with your permission for it, and service info. */
const ServicePage: FC = () => {
  const { serviceSlug = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError } = useServiceDetails(serviceSlug);
  const { data: connections, isPending: connectionsPending } = useConnections();
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const del = useDeleteConnection();
  const [connectOpen, setConnectOpen] = useState(false);
  const [renaming, setRenaming] = useState<Connection | null>(null);
  const [limiting, setLimiting] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);
  const disconnectAll = useDisconnectAccounts();

  const accounts = useMemo(() => connections?.filter((c) => c.service_key === serviceSlug) ?? [], [connections, serviceSlug]);
  /** Accounts the user may remove; shared ones added by an admin stay when a member disconnects. */
  const manageable = useMemo(() => accounts.filter((c) => c.can_manage), [accounts]);
  // Stable object: ConnectDialog resets its form whenever `toolkit` changes identity.
  const dialogToolkit = useMemo(() => (connectOpen && data ? { ...data.toolkit, connected_count: accounts.length } : null), [connectOpen, data, accounts.length]);
  const counts = useMemo(() => ({ read: data?.tools.filter((t) => t.group === ToolGroups.READ).length ?? 0, write: data?.tools.filter((t) => t.group === ToolGroups.WRITE).length ?? 0 }), [data]);

  const back = (
    <>
      <Button variant="ghost" size="sm" className="mb-3 hidden md:inline-flex" onClick={() => navigate(Routes.connections.root)}>
        <ArrowLeft /> Connections
      </Button>
      <div className="mb-3 md:hidden">
        <BackButton fallback={Routes.connections.root} />
      </div>
    </>
  );

  if (isPending) {
    return (
      <PageContainer>
        {back}
        <div className="max-w-[760px] space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-md" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer>
        {back}
        <EmptyState title="Service not found" description="It may have been renamed or is no longer available." action={<Button onClick={() => navigate(Routes.connections.root)}>Back to Connections</Button>} />
      </PageContainer>
    );
  }

  const { toolkit } = data;
  const canConnect = toolkit.allowed;

  return (
    <PageContainer>
      {back}
      <div className="max-w-[760px] space-y-8">
        <header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <ServiceLogo src={toolkit.logo} name={toolkit.name} size={56} />
              <h1 className="min-w-0 truncate font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{toolkit.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {manageable.length ? (
                <Button variant="outline" onClick={() => setDisconnectingAll(true)}>
                  <Unplug /> Disconnect
                </Button>
              ) : (
                <Button disabled={!canConnect} onClick={() => setConnectOpen(true)} title={canConnect ? undefined : "Not allowed by your organisation"}>
                  <Plug /> Connect
                </Button>
              )}
            </div>
          </div>
          {toolkit.description && <p className="mt-3 text-[15px] text-body">{toolkit.description}</p>}
        </header>

        <section>
          <SectionTitle title="Accounts" count={accounts.length || undefined} />
          <Card>
            {connectionsPending ? (
              <div className="p-4">
                <Skeleton className="h-10" />
              </div>
            ) : (
              accounts.map((c) => <AccountRow key={c.id} c={c} isAdmin={isAdmin} onRename={() => setRenaming(c)} onLimit={() => setLimiting(c)} onDelete={() => setDeleting(c)} />)
            )}
            {!connectionsPending && !accounts.length && <p className="px-4 pt-3 text-sm text-muted-foreground">No {toolkit.name} account connected yet.</p>}
            <button
              type="button"
              disabled={!canConnect}
              onClick={() => setConnectOpen(true)}
              className="flex min-h-[48px] w-full items-center gap-2 px-4 text-sm font-semibold text-body transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {accounts.length ? "Add another account" : `Connect ${toolkit.name}`}
            </button>
          </Card>
          {!canConnect && <p className="mt-1.5 px-1 text-[13px] text-muted-foreground">Your organisation doesn't allow connecting {toolkit.name}.</p>}
        </section>

        <ToolPermissionsSection serviceSlug={serviceSlug} serviceName={toolkit.name} tools={data.tools} />

        <section>
          <SectionTitle title="Information" />
          <Card>
            <InfoRow label="Tools">
              {data.tools.length} ({counts.read} reads, {counts.write} writes)
            </InfoRow>
            {toolkit.categories.length > 0 && <InfoRow label="Category"><span className="capitalize">{toolkit.categories.slice(0, 3).join(", ")}</span></InfoRow>}
            <InfoRow label="Sign-in">{toolkit.managed ? "Service's own sign-in screen" : (toolkit.auth_schemes.join(", ").toLowerCase().replace(/_/g, " ") || "None")}</InfoRow>
            {toolkit.website && (
              <InfoRow label="Website">
                <a href={websiteUrl(toolkit.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink hover:underline">
                  {toolkit.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </InfoRow>
            )}
            <InfoRow label="Your accounts">{accounts.length}</InfoRow>
          </Card>
        </section>
      </div>

      <ConnectDialog toolkit={dialogToolkit} isAdmin={isAdmin} onClose={() => setConnectOpen(false)} />
      <RenameConnectionDialog connection={renaming} onClose={() => setRenaming(null)} />
      <LimitBotsDialog connection={limiting} onClose={() => setLimiting(null)} />
      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Disconnect ${deleting?.label ?? ""}?`}
        description="Bots will no longer be able to use this account. The sign-in is removed immediately."
        confirmText="Disconnect"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
      <ConfirmationDialog
        isOpen={disconnectingAll}
        onClose={() => setDisconnectingAll(false)}
        title={`Disconnect ${data.toolkit.name}?`}
        description={
          manageable.length > 1
            ? `All ${manageable.length} of your ${data.toolkit.name} accounts are removed and bots can no longer use them. Your tool permissions are kept.`
            : `Bots will no longer be able to use ${manageable[0]?.label ?? data.toolkit.name}. Your tool permissions are kept.`
        }
        confirmText="Disconnect"
        variant="destructive"
        isLoading={disconnectAll.isPending}
        onConfirm={() => disconnectAll.mutate(manageable.map((c) => c.id), { onSuccess: () => setDisconnectingAll(false) })}
      />
    </PageContainer>
  );
};

export default ServicePage;
