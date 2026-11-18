import { useEffect, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BotAvatar } from "@/components/ui/bot-avatar";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useCreateCredential, useCredentialHistory, useCredentialUsage, useDeleteCredential, useReplaceCredential, useUpdateCredential } from "@/features/connections/hooks/use-connections";
import type { Credential } from "@/features/connections/interfaces/connections.interfaces";
import { CredentialEventOptions, VisibilityOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/date";
import { AddSecretKinds, addSecretSchema, renameSecretSchema, replaceLoginSchema, replaceSecretSchema, type AddSecretFormValues, type RenameSecretFormValues, type ReplaceLoginFormValues, type ReplaceSecretFormValues } from "../validation-schemas/secret.schema";
import { SecretField } from "./secret-field";
import { CredentialKinds, Visibilities } from "@/features/connections/interfaces/connections.interfaces";

const ADD_KIND_OPTIONS = [
  { id: AddSecretKinds.API_KEY, label: "Access key" },
  { id: AddSecretKinds.WEBSITE_LOGIN, label: "Website login" },
] as const;

const ADD_DEFAULTS: AddSecretFormValues = { kind: AddSecretKinds.API_KEY, label: "", service_name: "", value: "", website: "", username: "", totp_secret: "", visibility: Visibilities.PRIVATE };

export const AddSecretDialog: FC<{ open: boolean; isAdmin: boolean; onClose: () => void }> = ({ open, isAdmin, onClose }) => {
  const create = useCreateCredential();
  const form = useForm<AddSecretFormValues>({ resolver: zodResolver(addSecretSchema), defaultValues: ADD_DEFAULTS });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: create.isPending, onClose: () => { form.reset(ADD_DEFAULTS); onClose(); } });
  const kind = form.watch("kind");
  const isLogin = kind === AddSecretKinds.WEBSITE_LOGIN;
  const submit = (v: AddSecretFormValues) =>
    create.mutate(
      v.kind === AddSecretKinds.WEBSITE_LOGIN
        ? { label: v.label, service_name: v.service_name || undefined, kind: v.kind, value: v.value, website: v.website, username: v.username, totp_secret: v.totp_secret || undefined, visibility: v.visibility }
        : { label: v.label, service_name: v.service_name || undefined, kind: v.kind, value: v.value, visibility: v.visibility },
      { onSuccess: () => { form.reset(ADD_DEFAULTS); onClose(); } },
    );
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a secret</DialogTitle>
            <DialogDescription>
              {isLogin
                ? "Your bot can sign in to this website on its cloud computer. The password is stored encrypted and only typed into this website — the bot never sees it."
                : "Stored encrypted. It's never shown again and bots never see it — they only use it through tools."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="add-secret" className="space-y-4" autoComplete="off" onSubmit={form.handleSubmit(submit)}>
              <FormField control={form.control} name="kind" render={({ field }) => <FormItem><FormLabel>Type</FormLabel><SegmentedControl ariaLabel="Type of secret" value={field.value} options={ADD_KIND_OPTIONS} onChange={field.onChange} /></FormItem>} />
              <FormField control={form.control} name="label" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder={isLogin ? "Supplier portal" : "Mailchimp – Marketing"} {...field} /></FormControl><FormMessage /></FormItem>} />
              {isLogin ? (
                <>
                  <FormField control={form.control} name="website" render={({ field }) => <FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="portal.acme.com" inputMode="url" spellCheck={false} {...field} /></FormControl><FormDescription>Only typed on this site and its subdomains, over https.</FormDescription><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="username" render={({ field }) => <FormItem><FormLabel>Username or email</FormLabel><FormControl><Input autoComplete="off" spellCheck={false} data-1p-ignore {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="value" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><FormControl><SecretField autoComplete="new-password" data-1p-ignore {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="totp_secret" render={({ field }) => <FormItem><FormLabel>Authenticator setup key (optional)</FormLabel><FormControl><SecretField placeholder="JBSW Y3DP EHPK 3PXP… or otpauth://" {...field} /></FormControl><FormDescription>Lets the bot enter two-step codes from an authenticator app. Codes sent by text or email still need you.</FormDescription><FormMessage /></FormItem>} />
                </>
              ) : (
                <>
                  <FormField control={form.control} name="service_name" render={({ field }) => <FormItem><FormLabel>Service</FormLabel><FormControl><Input placeholder="Mailchimp" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="value" render={({ field }) => <FormItem><FormLabel>Secret</FormLabel><FormControl><SecretField placeholder="Paste the key or token" {...field} /></FormControl><FormMessage /></FormItem>} />
                </>
              )}
              <FormField control={form.control} name="visibility" render={({ field }) => <FormItem><FormLabel>Who can use it</FormLabel><SegmentedControl ariaLabel="Visibility" value={field.value} options={VisibilityOptions.filter((o) => o.id === Visibilities.PRIVATE || isAdmin)} onChange={field.onChange} /></FormItem>} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" form="add-secret" loading={create.isPending}>Save securely</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const RenameSecretDialog: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) => {
  const update = useUpdateCredential();
  const form = useForm<RenameSecretFormValues>({ resolver: zodResolver(renameSecretSchema), defaultValues: { label: "", service_name: "" } });
  useEffect(() => { if (secret) form.reset({ label: secret.label, service_name: secret.service_name ?? "" }); }, [secret, form]);
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: update.isPending, onClose });
  return (
    <>
      <Dialog open={!!secret} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename secret</DialogTitle>
            <DialogDescription>Change the name and service label. The value stays the same.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="rename-secret" className="space-y-4" onSubmit={form.handleSubmit((v) => update.mutate({ id: secret!.id, label: v.label, service_name: v.service_name || undefined }, { onSuccess: onClose }))}>
              <FormField control={form.control} name="label" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="service_name" render={({ field }) => <FormItem><FormLabel>Service</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={update.isPending}>Cancel</Button>
            <Button type="submit" form="rename-secret" loading={update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

const LOGIN_REPLACE_DEFAULTS: ReplaceLoginFormValues = { value: "", username: "", totp_secret: "", remove_totp: false };

const ReplaceLoginDialog: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) => {
  const replace = useReplaceCredential();
  const form = useForm<ReplaceLoginFormValues>({ resolver: zodResolver(replaceLoginSchema), defaultValues: LOGIN_REPLACE_DEFAULTS });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: replace.isPending, onClose: () => { form.reset(LOGIN_REPLACE_DEFAULTS); onClose(); } });
  const removeTotp = form.watch("remove_totp");
  const submit = (v: ReplaceLoginFormValues) =>
    replace.mutate(
      { id: secret!.id, value: v.value, username: v.username || undefined, totp_secret: v.remove_totp ? "" : v.totp_secret || undefined },
      { onSuccess: () => { form.reset(LOGIN_REPLACE_DEFAULTS); onClose(); } },
    );
  return (
    <>
      <Dialog open={!!secret} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update login</DialogTitle>
            <DialogDescription>For {secret?.website_domain} ({secret?.masked_hint}). Leave the username and authenticator key empty to keep the current ones.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="replace-login" className="space-y-4" autoComplete="off" onSubmit={form.handleSubmit(submit)}>
              <FormField control={form.control} name="value" render={({ field }) => <FormItem><FormLabel>New password</FormLabel><FormControl><SecretField autoFocus autoComplete="new-password" data-1p-ignore {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="username" render={({ field }) => <FormItem><FormLabel>New username (optional)</FormLabel><FormControl><Input autoComplete="off" spellCheck={false} data-1p-ignore {...field} /></FormControl><FormMessage /></FormItem>} />
              {!removeTotp && <FormField control={form.control} name="totp_secret" render={({ field }) => <FormItem><FormLabel>New authenticator setup key (optional)</FormLabel><FormControl><SecretField {...field} /></FormControl><FormMessage /></FormItem>} />}
              <FormField control={form.control} name="remove_totp" render={({ field }) => <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /></FormControl><FormLabel className="font-normal">Remove the authenticator key</FormLabel></FormItem>} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={replace.isPending}>Cancel</Button>
            <Button type="submit" form="replace-login" loading={replace.isPending}>Save securely</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const ReplaceSecretDialog: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) =>
  secret?.kind === CredentialKinds.WEBSITE_LOGIN ? <ReplaceLoginDialog secret={secret} onClose={onClose} /> : <ReplaceKeyDialog secret={secret} onClose={onClose} />;

const ReplaceKeyDialog: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) => {
  const replace = useReplaceCredential();
  const form = useForm<ReplaceSecretFormValues>({ resolver: zodResolver(replaceSecretSchema), defaultValues: { value: "" } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: replace.isPending, onClose: () => { form.reset(); onClose(); } });
  return (
    <>
      <Dialog open={!!secret} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace value</DialogTitle>
            <DialogDescription>The current value ({secret?.masked_hint}) keeps working until the new one is saved, then it's destroyed.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="replace-secret" onSubmit={form.handleSubmit((v) => replace.mutate({ id: secret!.id, value: v.value }, { onSuccess: () => { form.reset(); onClose(); } }))}>
              <FormField control={form.control} name="value" render={({ field }) => <FormItem><FormLabel>New value</FormLabel><FormControl><SecretField autoFocus placeholder="Paste the new key" {...field} /></FormControl><FormMessage /></FormItem>} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={replace.isPending}>Cancel</Button>
            <Button type="submit" form="replace-secret" loading={replace.isPending}>Replace securely</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};

export const ChooseBotsDialog: FC<{ secret: Credential | null; isAdmin: boolean; onClose: () => void }> = ({ secret, onClose }) => {
  const { data: bots } = useBots();
  const update = useUpdateCredential();
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (secret) setSel(new Set(secret.bots.map((b) => b.id))); }, [secret]);
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Which bots may use it?</DialogTitle>
          <DialogDescription>Leave everything unticked to let all of your bots use "{secret?.label}".</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] divide-y divide-hairline overflow-y-auto">
          {bots?.map((b) => (
            <label key={b.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
              <Checkbox checked={sel.has(b.id)} onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(b.id); else n.delete(b.id); return n; })} />
              <BotAvatar emoji={b.emoji} color={b.color} size={32} name={b.name} />
              <span className="font-semibold">{b.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button loading={update.isPending} onClick={() => update.mutate({ id: secret!.id, bot_ids: [...sel] }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteSecretDialog: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) => {
  const del = useDeleteCredential();
  const { data: usage } = useCredentialUsage(secret?.id ?? null);
  const users = [...(usage?.bots.map((b) => `${b.emoji} ${b.name}`) ?? []), ...(usage?.tool_servers.map((t) => t.name) ?? [])];
  return (
    <ConfirmationDialog
      isOpen={!!secret}
      onClose={onClose}
      title={`Delete "${secret?.label ?? ""}"?`}
      description={`Deletion is immediate and permanent.${users.length ? ` Used by: ${users.join(", ")}.` : ""} Bots will ask for a new one next time they need it.`}
      confirmText="Delete"
      variant="destructive"
      isLoading={del.isPending}
      onConfirm={() => secret && del.mutate(secret.id, { onSuccess: onClose })}
    />
  );
};

export const HistorySheet: FC<{ secret: Credential | null; onClose: () => void }> = ({ secret, onClose }) => {
  const { data, isPending } = useCredentialHistory(secret?.id ?? null);
  return (
    <Sheet open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>{secret?.label} — values are never shown.</SheetDescription>
        </SheetHeader>
        {isPending ? (
          <div className="mt-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : (
          <ol className="mt-4 divide-y divide-hairline">
            {data?.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-sm font-bold text-ink">{getDropdownOptionLabel(CredentialEventOptions, e.type)}{e.action ? ` · ${e.action}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {e.bot ? `${e.bot.emoji} ${e.bot.name}` : ""}{e.bot && e.user ? " for " : ""}{e.user?.name ?? e.user?.email ?? ""} · {formatDateTime(e.created_at)}
                </p>
              </li>
            ))}
            {!data?.length && <li className="py-6 text-center text-sm text-muted-foreground">No history yet.</li>}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
};
