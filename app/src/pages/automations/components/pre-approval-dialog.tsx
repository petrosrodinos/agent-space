import type { FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionTypeOptions } from "@/config/constants/dropdowns/bots/bot-settings-form.options";
import type { ActionType } from "@/features/bots/interfaces/bots.interfaces";
import { useUpdateAutomation } from "@/features/automations/hooks/use-automations";
import type { Automation } from "@/features/automations/interfaces/automations.interfaces";
import { preApprovalSchema, type PreApprovalFormValues } from "../validation-schemas/automation.schema";
import { ActionTypes } from "@/features/bots/interfaces/bots.interfaces";

const NO_CONNECTION = "__any__";
/** Organisation-enforced actions and Sensitive-bot consults can never be pre-approved (§10.3). */
const NEVER: ActionType[] = [ActionTypes.CONSULT_SENSITIVE_BOT, ActionTypes.OTHER];

export const PreApprovalDialog: FC<{ automation: Automation; open: boolean; onClose: () => void }> = ({ automation: a, open, onClose }) => {
  const update = useUpdateAutomation();
  const defaults: PreApprovalFormValues = { action_type: ActionTypes.SEND_MESSAGE, connection_id: a.connections[0]?.id ?? NO_CONNECTION, target: "" };
  const form = useForm<PreApprovalFormValues>({ resolver: zodResolver(preApprovalSchema), defaultValues: defaults });
  const close = () => {
    form.reset(defaults);
    onClose();
  };
  const submit = (v: PreApprovalFormValues) =>
    update.mutate(
      {
        id: a.id,
        pre_approvals: [
          ...a.pre_approvals.map((p) => ({ action_type: p.action_type, connection_id: p.connection_id, target: p.target })),
          { action_type: v.action_type as ActionType, connection_id: v.connection_id === NO_CONNECTION ? null : v.connection_id, target: v.target },
        ],
      },
      { onSuccess: close },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !update.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pre-approve an action</DialogTitle>
          <DialogDescription>Runs can do this one kind of action to this one place without asking. Anything else still asks you.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="pre-approval" className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <FormField control={form.control} name="action_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Action</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{ActionTypeOptions.filter((o) => !NEVER.includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="connection_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NO_CONNECTION}>Any of its accounts</SelectItem>
                    {a.connections.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="target" render={({ field }) => (
              <FormItem>
                <FormLabel>Where exactly</FormLabel>
                <FormControl><Input placeholder="channel:#security" maxLength={300} {...field} /></FormControl>
                <FormDescription>One specific place, e.g. channel:#security, repo:acme/website, email:anna@acme.com</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close} disabled={update.isPending}>Cancel</Button>
          <Button type="submit" form="pre-approval" loading={update.isPending}>Pre-approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
