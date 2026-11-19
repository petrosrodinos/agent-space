import type { FC } from "react";
import { Link } from "react-router-dom";
import { Bot as BotIcon, MoreHorizontal, Pencil, RefreshCw, Star, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useReconnect, useSetServiceDefault, useUpdateConnection } from "@/features/connections/hooks/use-connections";
import type { Connection } from "@/features/connections/interfaces/connections.interfaces";
import { ConnectionKinds, ConnectionStatuses, Visibilities } from "@/features/connections/interfaces/connections.interfaces";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

export const ServiceLogo: FC<{ src?: string | null; name: string; size?: number }> = ({ src, name, size = 40 }) =>
  src ? (
    <img src={src} alt="" className="shrink-0 rounded-md bg-white object-contain p-1.5 shadow-sticker" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-surface-sunken font-extrabold text-body" style={{ width: size, height: size }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );

export const connectionTone = (s: string) => (s === ConnectionStatuses.ACTIVE ? "success" : s === ConnectionStatuses.ERROR ? "error" : "warning") as "success" | "error" | "warning";

/** Starts the service sign-in again for an expired (or any) connected account. */
export const useReconnectAndRedirect = () => {
  const reconnect = useReconnect();
  const run = (id: string) => reconnect.mutate({ id, return_url: platform.links.returnUrl(Routes.connections.callback) }, { onSuccess: (r) => r.redirect_url && platform.links.redirect(r.redirect_url) });
  return { run, isPending: reconnect.isPending };
};

/** Row actions for one connected account: default, rename, share, limit to bots, reconnect, disconnect. */
export const ConnectionActionsMenu: FC<{ c: Connection; isAdmin: boolean; onRename: () => void; onLimit: () => void; onDelete: () => void }> = ({ c, isAdmin, onRename, onLimit, onDelete }) => {
  const reconnect = useReconnectAndRedirect();
  const update = useUpdateConnection();
  const setDefault = useSetServiceDefault();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Actions for ${c.label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-md p-1.5">
        {!c.is_default && (
          <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => setDefault.mutate({ service_key: c.service_key, connection_id: c.id })}>
            <Star className="h-4 w-4" /> Use by default for {c.service_name}
          </DropdownMenuItem>
        )}
        {c.can_manage && (
          <>
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onRename}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => update.mutate({ id: c.id, visibility: c.visibility === Visibilities.SHARED ? Visibilities.PRIVATE : Visibilities.SHARED })}>
                <Users className="h-4 w-4" /> {c.visibility === Visibilities.SHARED ? "Make private" : "Share with organisation"}
              </DropdownMenuItem>
            )}
            {c.visibility === Visibilities.SHARED && (
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onLimit}>
                <BotIcon className="h-4 w-4" /> Limit to bots
              </DropdownMenuItem>
            )}
            {c.kind === ConnectionKinds.COMPOSIO && (
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => reconnect.run(c.id)}>
                <RefreshCw className="h-4 w-4" /> Reconnect
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-sm text-error focus:text-error" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" /> Disconnect
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ConnectionBadges: FC<{ c: Connection }> = ({ c }) => (
  <>
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
  </>
);

/** A connected account card on the Connections page. Service sign-in connections open the service details page. */
export const ConnectionTile: FC<{ c: Connection; logo?: string | null; isAdmin: boolean; onRename: () => void; onLimit: () => void; onDelete: () => void }> = ({ c, logo, isAdmin, onRename, onLimit, onDelete }) => {
  const reconnect = useReconnectAndRedirect();
  const hasDetails = c.kind === ConnectionKinds.COMPOSIO;
  return (
    <div className={cn("relative flex items-start gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-sticker", hasDetails && "card-lift")}>
      {hasDetails && <Link to={Routes.connections.service(c.service_key)} aria-label={`${c.label} — ${c.service_name} details`} className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
      <ServiceLogo src={logo} name={c.service_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-bold text-ink">{c.label}</span>
          <ConnectionBadges c={c} />
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {c.account_identifier ?? c.service_name}
          {c.masked_hint ? ` · ${c.masked_hint}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={connectionTone(c.status)}>{getDropdownOptionLabel(ConnectionStatusOptions, c.status)}</StatusPill>
          {c.restricted_bots.length > 0 && <span className="text-xs text-muted-foreground">Only {c.restricted_bots.map((b) => b.name).join(", ")}</span>}
          {c.status !== ConnectionStatuses.ACTIVE && c.kind === ConnectionKinds.COMPOSIO && c.can_manage && (
            <Button size="sm" variant="outline" className="relative z-10" loading={reconnect.isPending} onClick={() => reconnect.run(c.id)}>
              <RefreshCw /> Reconnect
            </Button>
          )}
        </div>
      </div>
      <div className="relative z-10">
        <ConnectionActionsMenu c={c} isAdmin={isAdmin} onRename={onRename} onLimit={onLimit} onDelete={onDelete} />
      </div>
    </div>
  );
};
