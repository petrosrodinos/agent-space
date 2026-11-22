import { useEffect, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BotAvatar } from "@/components/ui/bot-avatar";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useAddApiKeyConnection, useConnectService, useUpdateConnection } from "@/features/connections/hooks/use-connections";
import type { Connection, Toolkit } from "@/features/connections/interfaces/connections.interfaces";
import { VisibilityOptions } from "@/config/constants/dropdowns/shared/status.options";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { apiKeySchema, connectSchema, renameSchema, type ApiKeyFormValues, type ConnectFormValues, type RenameFormValues } from "../validation-schemas/connection.schema";
import { SecretField } from "./secret-field";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";

const visibilityOptions = (isAdmin: boolean) => VisibilityOptions.filter((o) => o.id === Visibilities.PRIVATE || isAdmin);

export const ConnectDialog: FC<{ toolkit: Toolkit | null; isAdmin: boolean; onClose: () => void }> = ({ toolkit, isAdmin, onClose }) => {
  const connect = useConnectService();
  const form = useForm<ConnectFormValues>({ resolver: zodResolver(connectSchema), defaultValues: { label: "", visibility: Visibilities.PRIVATE } });
  useEffect(() => {
    if (toolkit) form.reset({ label: toolkit.connected_count ? `${toolkit.name} – ` : toolkit.name, visibility: Visibilities.PRIVATE });
  }, [toolkit, form]);
  const busy = connect.isPending;
  return (
    <Dialog open={!!toolkit} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {toolkit?.name}</DialogTitle>
          <DialogDescription>You'll sign in on {toolkit?.name}'s own screen. Agent Space never sees your password.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="connect-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((v) =>
              connect.mutate(
                { toolkit: toolkit!.slug, label: v.label || undefined, visibility: v.visibility, return_url: platform.links.returnUrl(Routes.connections.callback) },
                {
                  onSuccess: (res) => {
                    if (res.redirect_url) platform.links.redirect(res.redirect_url);
                    else platform.links.redirect(`${window.location.origin}${Routes.connections.callback}?connection=${res.connection_id}`);
                  },
                },
              ),
            )}
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder={`${toolkit?.name ?? ""} – Work`} {...field} />
                  </FormControl>
                  <FormDescription>Helps tell accounts apart, e.g. "Gmail – Sales".</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who can use it</FormLabel>
                  <SegmentedControl ariaLabel="Visibility" value={field.value} options={visibilityOptions(isAdmin)} onChange={field.onChange} />
                  {!isAdmin && <FormDescription>Only Owners and Admins can add shared connections.</FormDescription>}
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="connect-form" loading={busy}>
            Continue to {toolkit?.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ApiKeyDialog: FC<{ open: boolean; isAdmin: boolean; onClose: () => void }> = ({ open, isAdmin, onClose }) => {
  const add = useAddApiKeyConnection();
  const form = useForm<ApiKeyFormValues>({ resolver: zodResolver(apiKeySchema), defaultValues: { service_name: "", label: "", api_key: "", visibility: Visibilities.PRIVATE } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    disabled: add.isPending,
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
            <DialogTitle>Add a service by access key</DialogTitle>
            <DialogDescription>For services we can't sign in to. The key is stored encrypted, never shown again and never seen by bots.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="api-key-form"
              className="space-y-4"
              onSubmit={form.handleSubmit((v) =>
                add.mutate(v, {
                  onSuccess: () => {
                    form.reset();
                    onClose();
                  },
                }),
              )}
            >
              <FormField control={form.control} name="service_name" render={({ field }) => <FormItem><FormLabel>Service</FormLabel><FormControl><Input placeholder="Mailchimp" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="label" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Mailchimp – Marketing" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="api_key" render={({ field }) => <FormItem><FormLabel>Access key</FormLabel><FormControl><SecretField placeholder="Paste the key" {...field} /></FormControl><FormMessage /></FormItem>} />
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
            <Button variant="outline" onClick={requestClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="api-key-form" loading={add.isPending}>
              Save securely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const RenameConnectionDialog: FC<{ connection: Connection | null; onClose: () => void }> = ({ connection, onClose }) => {
  const update = useUpdateConnection();
  const form = useForm<RenameFormValues>({ resolver: zodResolver(renameSchema), defaultValues: { label: "" } });
  useEffect(() => {
    if (connection) form.reset({ label: connection.label });
  }, [connection, form]);
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: update.isPending, onClose });
  return (
    <>
      <Dialog open={!!connection} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename connection</DialogTitle>
            <DialogDescription>{connection?.service_name}{connection?.account_identifier ? ` · ${connection.account_identifier}` : ""}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="rename-conn" onSubmit={form.handleSubmit((v) => update.mutate({ id: connection!.id, label: v.label }, { onSuccess: onClose }))}>
              <FormField control={form.control} name="label" render={({ field }) => <FormItem><FormLabel>Label</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={update.isPending}>Cancel</Button>
            <Button type="submit" form="rename-conn" loading={update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const LimitBotsDialog: FC<{ connection: Connection | null; onClose: () => void }> = ({ connection, onClose }) => {
  const { data: bots } = useBots();
  const update = useUpdateConnection();
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (connection) setSel(new Set(connection.restricted_bots.map((b) => b.id)));
  }, [connection]);
  return (
    <Dialog open={!!connection} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Limit to bots</DialogTitle>
          <DialogDescription>Choose which bots may use "{connection?.label}". Leave everything unticked to allow all bots.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] divide-y divide-hairline overflow-y-auto">
          {bots?.map((b) => (
            <label key={b.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
              <Checkbox checked={sel.has(b.id)} onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(b.id); else n.delete(b.id); return n; })} />
              <BotAvatar seed={b.avatar_seed} color={b.color} size={32} name={b.name} />
              <span className="font-semibold">{b.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button loading={update.isPending} onClick={() => update.mutate({ id: connection!.id, restricted_bot_ids: [...sel] }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
