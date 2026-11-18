import { useMemo, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Bot as BotIcon, Check, KeyRound, MoreHorizontal, Pencil, Plug, RefreshCw, Search, Star, Trash2, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCatalog, useCategories, useConnections, useDeleteConnection, useReconnect, useSetServiceDefault, useUpdateConnection } from "@/features/connections/hooks/use-connections";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { Connection, Toolkit } from "@/features/connections/interfaces/connections.interfaces";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { ApiKeyDialog, ConnectDialog, LimitBotsDialog, RenameConnectionDialog } from "./components/connection-dialogs";
import { ToolServersSection } from "./components/tool-servers-section";
import { ConnectionStatuses, ConnectionKinds, Visibilities } from "@/features/connections/interfaces/connections.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

const Logo: FC<{ src?: string | null; name: string; size?: number }> = ({ src, name, size = 40 }) =>
  src ? (
    <img src={src} alt="" className="shrink-0 rounded-[12px] bg-white object-contain p-1.5 shadow-sticker" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-surface-sunken font-extrabold text-body" style={{ width: size, height: size }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );

const tone = (s: string) => (s === ConnectionStatuses.ACTIVE ? "success" : s === ConnectionStatuses.ERROR ? "error" : "warning") as "success" | "error" | "warning";

const ConnectionTile: FC<{ c: Connection; logo?: string | null; isAdmin: boolean; onRename: () => void; onLimit: () => void; onDelete: () => void }> = ({ c, logo, isAdmin, onRename, onLimit, onDelete }) => {
  const reconnect = useReconnect();
  const update = useUpdateConnection();
  const setDefault = useSetServiceDefault();
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker">
      <Logo src={logo} name={c.service_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-bold text-ink">{c.label}</span>
          {c.visibility === Visibilities.SHARED && (
            <Badge variant="secondary">
              <Users className="h-3 w-3" /> Shared
            </Badge>
          )}
          {c.is_default && (
            <Badge variant="secondary">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{c.account_identifier ?? c.service_name}{c.masked_hint ? ` · ${c.masked_hint}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={tone(c.status)}>{getDropdownOptionLabel(ConnectionStatusOptions, c.status)}</StatusPill>
          {c.restricted_bots.length > 0 && <span className="text-xs text-muted-foreground">Only {c.restricted_bots.map((b) => b.name).join(", ")}</span>}
          {c.status !== ConnectionStatuses.ACTIVE && c.kind === ConnectionKinds.COMPOSIO && c.can_manage && (
            <Button size="sm" variant="outline" loading={reconnect.isPending} onClick={() => reconnect.mutate({ id: c.id, return_url: platform.links.returnUrl(Routes.connections.callback) }, { onSuccess: (r) => r.redirect_url && platform.links.redirect(r.redirect_url) })}>
              <RefreshCw /> Reconnect
            </Button>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Actions for ${c.label}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-[14px] p-1.5">
          {!c.is_default && (
            <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => setDefault.mutate({ service_key: c.service_key, connection_id: c.id })}>
              <Star className="h-4 w-4" /> Use by default for {c.service_name}
            </DropdownMenuItem>
          )}
          {c.can_manage && (
            <>
              <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onRename}>
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => update.mutate({ id: c.id, visibility: c.visibility === Visibilities.SHARED ? Visibilities.PRIVATE : Visibilities.SHARED })}>
                  <Users className="h-4 w-4" /> {c.visibility === Visibilities.SHARED ? "Make private" : "Share with organisation"}
                </DropdownMenuItem>
              )}
              {c.visibility === Visibilities.SHARED && (
                <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={onLimit}>
                  <BotIcon className="h-4 w-4" /> Limit to bots
                </DropdownMenuItem>
              )}
              {c.kind === ConnectionKinds.COMPOSIO && (
                <DropdownMenuItem className="gap-2 rounded-[10px]" onSelect={() => reconnect.mutate({ id: c.id, return_url: platform.links.returnUrl(Routes.connections.callback) }, { onSuccess: (r) => r.redirect_url && platform.links.redirect(r.redirect_url) })}>
                  <RefreshCw className="h-4 w-4" /> Reconnect
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 rounded-[10px] text-error focus:text-error" onSelect={onDelete}>
                <Trash2 className="h-4 w-4" /> Disconnect
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const ConnectionsPage: FC = () => {
  const { data: allConnections, isPending } = useConnections();
  // Custom tool servers have their own section below.
  const connections = useMemo(() => allConnections?.filter((c) => c.kind !== ConnectionKinds.MCP), [allConnections]);
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const catalog = useCatalog(search, category);
  const { data: categories } = useCategories();
  const del = useDeleteConnection();
  const [connecting, setConnecting] = useState<Toolkit | null>(null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [renaming, setRenaming] = useState<Connection | null>(null);
  const [limiting, setLimiting] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);
  const toolkits = useMemo(() => catalog.data?.pages.flatMap((p) => p.items) ?? [], [catalog.data]);
  const logos = useMemo(() => new Map(toolkits.map((t) => [t.slug, t.logo])), [toolkits]);

  return (
    <PageContainer wide>
      <PageHeader
        title="Connections"
        description="Link the tools you already use. Bots act with your accounts without ever seeing passwords or tokens."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={Routes.secrets}>
                <KeyRound /> Secrets
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setApiKeyOpen(true)}>
              <KeyRound /> Add by access key
            </Button>
          </>
        }
      />

      <section className="mb-10">
        <h2 className="eyebrow mb-3">Your connections</h2>
        {isPending ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[20px]" />)}</div>
        ) : !connections?.length ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-dashed border-hairline-strong p-5 text-sm text-muted-foreground">
            <Plug className="h-5 w-5" /> Nothing connected yet. Pick a service below — Gmail and Google Calendar are a great start.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((c) => (
              <ConnectionTile key={c.id} c={c} logo={logos.get(c.service_key)} isAdmin={isAdmin} onRename={() => setRenaming(c)} onLimit={() => setLimiting(c)} onDelete={() => setDeleting(c)} />
            ))}
          </div>
        )}
      </section>

      <ToolServersSection isAdmin={isAdmin} membersMayAdd={org?.settings?.members_private_tool_servers !== false} />

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="eyebrow">Add a connection</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search services" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search services" />
          </div>
        </div>
        <div className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "", name: "All" }, ...(categories ?? []).slice(0, 18)].map((c) => (
            <button
              key={c.id || ALL_FILTER}
              onClick={() => setCategory(c.id)}
              className={cn("min-h-[36px] shrink-0 rounded-full px-3.5 text-sm font-bold capitalize transition-colors", category === c.id ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-body hover:bg-hairline")}
            >
              {c.name}
            </button>
          ))}
        </div>
        {catalog.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[20px]" />)}</div>
        ) : !toolkits.length ? (
          <p className="py-10 text-center text-muted-foreground">No services found{search ? ` for "${search}"` : ""}. You can still add one by access key.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {toolkits.map((t) => (
                <div key={t.slug} className="card-lift flex flex-col rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker">
                  <div className="flex items-center gap-3">
                    <Logo src={t.logo} name={t.name} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{t.name}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">{t.categories.slice(0, 2).join(" · ") || "Service"}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-body">{t.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {t.connected_count > 0 ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check className="h-3 w-3" /> {t.connected_count} connected</span> : <span />}
                    <Button size="sm" variant={t.connected_count ? "outline" : "default"} disabled={!t.allowed} onClick={() => setConnecting(t)} title={t.allowed ? undefined : "Not allowed by your organisation"}>
                      {t.connected_count ? "Add another" : "Connect"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {catalog.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" loading={catalog.isFetchingNextPage} onClick={() => catalog.fetchNextPage()}>
                  Show more services
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <ConnectDialog toolkit={connecting} isAdmin={isAdmin} onClose={() => setConnecting(null)} />
      <ApiKeyDialog open={apiKeyOpen} isAdmin={isAdmin} onClose={() => setApiKeyOpen(false)} />
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
    </PageContainer>
  );
};

export default ConnectionsPage;
