import { useEffect, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bot as BotIcon, LogIn, MoreHorizontal, Pencil, Plus, RefreshCw, Server, Trash2, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import {
  useCreateToolServer, useDeleteToolServer, useSetToolServerToken, useStartToolServerSignIn, useTestToolServer, useToolServers, useUpdateToolServer,
} from "@/features/tool-servers/hooks/use-tool-servers";
import type { ToolServer, ToolServerAuthKind } from "@/features/tool-servers/interfaces/tool-servers.interfaces";
import { ConnectionStatusOptions, VisibilityOptions } from "@/config/constants/dropdowns/shared/status.options";
import { ToolServerAuthOptions } from "@/config/constants/dropdowns/connections/tool-server.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import { platform } from "@/platform";
import { editToolServerSchema, toolServerSchema, type EditToolServerFormValues, type ToolServerFormValues } from "../validation-schemas/tool-server.schema";
import { SecretField } from "./secret-field";
import { ToolServerStatuses, ToolServerAuthKinds } from "@/features/tool-servers/interfaces/tool-servers.interfaces";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";

const tone = (s: string) => (s === ToolServerStatuses.ACTIVE ? "success" : s === ToolServerStatuses.ERROR ? "error" : "warning") as "success" | "error" | "warning";
const visibilityOptions = (isAdmin: boolean) => VisibilityOptions.filter((o) => o.id === Visibilities.PRIVATE || isAdmin);

/** §8.4 Custom tool servers: MCP servers added by address, with no sign-in, an access token or the server's own sign-in. */
export const ToolServersSection: FC<{ isAdmin: boolean; membersMayAdd: boolean }> = ({ isAdmin, membersMayAdd }) => {
  const { data: servers, isPending } = useToolServers();
  const del = useDeleteToolServer();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ToolServer | null>(null);
  const [limiting, setLimiting] = useState<ToolServer | null>(null);
  const [deleting, setDeleting] = useState<ToolServer | null>(null);
  const canAdd = isAdmin || membersMayAdd;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="eyebrow">Custom tool servers</h2>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Add tool server
          </Button>
        )}
      </div>
      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
        </div>
      ) : !servers?.length ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-hairline-strong p-5 text-sm text-muted-foreground">
          <Server className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Connect your own tools, like an internal company system, through an MCP server address. Its tools appear next to your other connections and bots can use them.
            {!canAdd && " Ask an Owner or Admin to add one."}
          </span>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {servers.map((s) => (
            <ToolServerTile key={s.id} s={s} isAdmin={isAdmin} onEdit={() => setEditing(s)} onLimit={() => setLimiting(s)} onDelete={() => setDeleting(s)} />
          ))}
        </div>
      )}

      <AddToolServerDialog open={adding} isAdmin={isAdmin} onClose={() => setAdding(false)} />
      <EditToolServerDialog server={editing} onClose={() => setEditing(null)} />
      <LimitToolServerBotsDialog server={limiting} onClose={() => setLimiting(null)} />
      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name ?? ""}?`}
        description="Bots will no longer be able to use its tools. Its access token or sign-in is deleted immediately."
        confirmText="Remove"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </section>
  );
};

const ToolServerTile: FC<{ s: ToolServer; isAdmin: boolean; onEdit: () => void; onLimit: () => void; onDelete: () => void }> = ({ s, isAdmin, onEdit, onLimit, onDelete }) => {
  const test = useTestToolServer();
  const signIn = useStartToolServerSignIn();
  const update = useUpdateToolServer();
  const host = (() => {
    try {
      return new URL(s.url).host;
    } catch {
      return s.url;
    }
  })();
  const startSignIn = () => signIn.mutate(s.id, { onSuccess: (r) => r.authorization_url && platform.links.redirect(r.authorization_url) });
  const needsSignIn = s.auth_kind === ToolServerAuthKinds.OAUTH && s.status === ToolServerStatuses.NEEDS_RECONNECTING;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-sticker">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
        <Wrench className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-bold text-ink">{s.name}</span>
          {s.visibility === Visibilities.SHARED && (
            <Badge variant="secondary">
              <Users className="h-3 w-3" /> Shared
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {host} · {getDropdownOptionLabel(ToolServerAuthOptions, s.auth_kind)}
          {s.masked_hint ? ` ${s.masked_hint}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={tone(s.status)}>{getDropdownOptionLabel(ConnectionStatusOptions, s.status)}</StatusPill>
          {s.status === ToolServerStatuses.ACTIVE && <span className="text-xs text-muted-foreground">{s.tool_count} {s.tool_count === 1 ? "tool" : "tools"}{s.last_listed_at ? ` · checked ${timeAgo(s.last_listed_at)}` : ""}</span>}
          {s.bots.length > 0 && <span className="text-xs text-muted-foreground">Only {s.bots.map((b) => b.name).join(", ")}</span>}
        </div>
        {s.status !== ToolServerStatuses.ACTIVE && s.status_message && <p className="mt-1.5 text-xs text-body">{s.status_message}</p>}
        {s.can_manage && (needsSignIn || s.status !== ToolServerStatuses.ACTIVE) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {s.auth_kind === ToolServerAuthKinds.OAUTH && (
              <Button size="sm" loading={signIn.isPending} onClick={startSignIn}>
                <LogIn /> Sign in
              </Button>
            )}
            <Button size="sm" variant="outline" loading={test.isPending} onClick={() => test.mutate(s.id)}>
              <RefreshCw /> Try again
            </Button>
          </div>
        )}
      </div>
      {s.can_manage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Actions for ${s.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-md p-1.5">
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => test.mutate(s.id)}>
              <RefreshCw className="h-4 w-4" /> Test connection
            </DropdownMenuItem>
            {s.auth_kind === ToolServerAuthKinds.OAUTH && (
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={startSignIn}>
                <LogIn className="h-4 w-4" /> Sign in again
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem className="gap-2 rounded-sm" onSelect={() => update.mutate({ id: s.id, visibility: s.visibility === Visibilities.SHARED ? Visibilities.PRIVATE : Visibilities.SHARED })}>
                <Users className="h-4 w-4" /> {s.visibility === Visibilities.SHARED ? "Make private" : "Share with organisation"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 rounded-sm" onSelect={onLimit}>
              <BotIcon className="h-4 w-4" /> Limit to bots
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-sm text-error focus:text-error" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const AddToolServerDialog: FC<{ open: boolean; isAdmin: boolean; onClose: () => void }> = ({ open, isAdmin, onClose }) => {
  const create = useCreateToolServer();
  const form = useForm<ToolServerFormValues>({ resolver: zodResolver(toolServerSchema), defaultValues: { name: "", url: "", auth_kind: ToolServerAuthKinds.NONE, token: "", visibility: Visibilities.PRIVATE } });
  const auth = form.watch("auth_kind");
  const { requestClose, dialogProps } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    disabled: create.isPending,
    onClose: () => {
      form.reset();
      onClose();
    },
  });
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a tool server</DialogTitle>
            <DialogDescription>Any server that speaks the Model Context Protocol (MCP). Tokens are stored encrypted and never shown to bots.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="tool-server-form"
              className="space-y-4"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(
                  { name: v.name, url: v.url, auth_kind: v.auth_kind, token: v.auth_kind === ToolServerAuthKinds.TOKEN ? v.token : undefined, visibility: v.visibility },
                  {
                    onSuccess: (r) => {
                      form.reset();
                      onClose();
                      if (r.authorization_url) platform.links.redirect(r.authorization_url);
                    },
                  },
                ),
              )}
            >
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Company CRM tools" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server address</FormLabel>
                    <FormControl><Input type="url" inputMode="url" placeholder="https://tools.example.com/mcp" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="auth_kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sign-in</FormLabel>
                    <SegmentedControl<ToolServerAuthKind> ariaLabel="Sign-in" value={field.value} options={ToolServerAuthOptions} onChange={field.onChange} />
                    <FormDescription>{ToolServerAuthOptions.find((o) => o.id === field.value)?.description}</FormDescription>
                  </FormItem>
                )}
              />
              {auth === ToolServerAuthKinds.TOKEN && (
                <FormField control={form.control} name="token" render={({ field }) => <FormItem><FormLabel>Access token</FormLabel><FormControl><SecretField placeholder="Paste the token" {...field} /></FormControl><FormMessage /></FormItem>} />
              )}
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who can use it</FormLabel>
                    <SegmentedControl ariaLabel="Visibility" value={field.value} options={visibilityOptions(isAdmin)} onChange={field.onChange} />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="tool-server-form" loading={create.isPending}>
              {auth === ToolServerAuthKinds.OAUTH ? "Continue to sign in" : "Add and connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

const EditToolServerDialog: FC<{ server: ToolServer | null; onClose: () => void }> = ({ server, onClose }) => {
  const update = useUpdateToolServer();
  const setToken = useSetToolServerToken();
  const form = useForm<EditToolServerFormValues>({ resolver: zodResolver(editToolServerSchema), defaultValues: { name: "", url: "", token: "" } });
  useEffect(() => {
    if (server) form.reset({ name: server.name, url: server.url, token: "" });
  }, [server, form]);
  const busy = update.isPending || setToken.isPending;
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: busy, onClose });
  return (
    <>
      <Dialog open={!!server} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit tool server</DialogTitle>
            <DialogDescription>Changing the address reconnects and reloads its tools.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="edit-tool-server"
              className="space-y-4"
              onSubmit={form.handleSubmit(async (v) => {
                if (!server) return;
                if (v.name !== server.name || v.url !== server.url) await update.mutateAsync({ id: server.id, name: v.name, url: v.url });
                if (server.auth_kind === ToolServerAuthKinds.TOKEN && v.token && v.token.length >= 4) await setToken.mutateAsync({ id: server.id, token: v.token });
                onClose();
              })}
            >
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="url" render={({ field }) => <FormItem><FormLabel>Server address</FormLabel><FormControl><Input type="url" inputMode="url" {...field} /></FormControl><FormMessage /></FormItem>} />
              {server?.auth_kind === ToolServerAuthKinds.TOKEN && (
                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Replace access token</FormLabel>
                      <FormControl><SecretField placeholder={server.masked_hint ? `Current: ${server.masked_hint}` : "Paste a new token"} {...field} /></FormControl>
                      <FormDescription>Leave empty to keep the current token. It is never shown again.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="edit-tool-server" loading={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

const LimitToolServerBotsDialog: FC<{ server: ToolServer | null; onClose: () => void }> = ({ server, onClose }) => {
  const { data: bots } = useBots();
  const update = useUpdateToolServer();
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (server) setSel(new Set(server.bots.map((b) => b.id)));
  }, [server]);
  return (
    <Dialog open={!!server} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Limit to bots</DialogTitle>
          <DialogDescription>Choose which bots may use "{server?.name}". Leave everything unticked to allow all bots.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] divide-y divide-hairline overflow-y-auto">
          {bots?.map((b) => (
            <label key={b.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
              <Checkbox
                checked={sel.has(b.id)}
                onCheckedChange={(v) =>
                  setSel((s) => {
                    const n = new Set(s);
                    if (v) n.add(b.id);
                    else n.delete(b.id);
                    return n;
                  })
                }
              />
              <BotAvatar emoji={b.emoji} color={b.color} size={32} name={b.name} />
              <span className="font-semibold">{b.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button loading={update.isPending} onClick={() => server && update.mutate({ id: server.id, bot_ids: [...sel] }, { onSuccess: onClose })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
