import { useMemo, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, KeyRound, Plug, Search } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useCatalog, useCategories, useConnections, useDeleteConnection } from "@/features/connections/hooks/use-connections";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { Connection } from "@/features/connections/interfaces/connections.interfaces";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { ApiKeyDialog, LimitBotsDialog, RenameConnectionDialog } from "./components/connection-dialogs";
import { ToolServersSection } from "./components/tool-servers-section";
import { ConnectionTile, ServiceLogo } from "./components/connection-tile";
import { ConnectionKinds } from "@/features/connections/interfaces/connections.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
        ) : !connections?.length ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-hairline-strong p-5 text-sm text-muted-foreground">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
        ) : !toolkits.length ? (
          <p className="py-10 text-center text-muted-foreground">No services found{search ? ` for "${search}"` : ""}. You can still add one by access key.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {toolkits.map((t) => (
                <Link
                  key={t.slug}
                  to={Routes.connections.service(t.slug)}
                  className="card-lift flex flex-col rounded-lg border border-hairline bg-surface p-4 shadow-sticker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <ServiceLogo src={t.logo} name={t.name} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{t.name}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">{t.categories.slice(0, 2).join(" · ") || "Service"}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-body">{t.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
                    {t.connected_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="h-3 w-3" /> {t.connected_count} connected
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t.allowed ? "Not connected" : "Not allowed by your organisation"}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
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
