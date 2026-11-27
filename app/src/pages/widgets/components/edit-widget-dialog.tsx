import { useEffect, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateWidget } from "@/features/widgets/hooks/use-widgets";
import type { Widget } from "@/features/widgets/interfaces/widgets.interfaces";
import { editWidgetSchema, type EditWidgetFormValues } from "../validation-schemas/widget.schema";

/** Rename a widget, or change what its bot is asked each time it's refreshed. */
export const EditWidgetDialog: FC<{ widget: Widget | null; onClose: () => void }> = ({ widget, onClose }) => {
  const update = useUpdateWidget();
  const form = useForm<EditWidgetFormValues>({ resolver: zodResolver(editWidgetSchema), defaultValues: { title: "", refresh_prompt: "" } });
  useEffect(() => {
    if (widget) form.reset({ title: widget.title, refresh_prompt: widget.refresh_prompt ?? "" });
  }, [widget, form]);

  return (
    <Dialog open={!!widget} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit widget</DialogTitle>
          <DialogDescription>Each time you open it, the bot answers this again with fresh data.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="edit-widget" className="space-y-4" onSubmit={form.handleSubmit((v) => widget && update.mutate({ id: widget.id, ...v }, { onSuccess: onClose }))}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="refresh_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What the bot is asked</FormLabel>
                  <FormControl><Textarea dictation rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button type="submit" form="edit-widget" loading={update.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
