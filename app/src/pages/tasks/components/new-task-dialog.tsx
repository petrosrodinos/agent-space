import { BotAvatar } from "@/components/ui/bot-avatar";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useStartTask } from "@/features/tasks/hooks/use-tasks";
import { Routes } from "@/routes/routes";
import { newTaskSchema, type NewTaskFormValues } from "../validation-schemas/task.schema";

export const NewTaskDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { data: bots } = useBots();
  const start = useStartTask();
  const navigate = useNavigate();
  const form = useForm<NewTaskFormValues>({ resolver: zodResolver(newTaskSchema), defaultValues: { bot_id: "", prompt: "" } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: start.isPending, onClose: () => { form.reset(); onClose(); } });
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Give a bot a job</DialogTitle>
            <DialogDescription>It keeps working after you leave and lets you know when it's done or needs you.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="new-task" className="space-y-4" onSubmit={form.handleSubmit((v) => start.mutate(v, { onSuccess: (r) => { form.reset(); onClose(); navigate(Routes.chat.conversation(r.conversation_id)); } }))}>
              <FormField
                control={form.control}
                name="bot_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Choose a bot" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bots?.map((b) => <SelectItem key={b.id} value={b.id}><span className="flex items-center gap-2"><BotAvatar seed={b.avatar_seed} color={b.color} size={24} />{b.name}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should it do?</FormLabel>
                    <FormControl><Textarea dictation rows={5} placeholder="Research the 10 top competitors and build a comparison table" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={start.isPending}>Cancel</Button>
            <Button type="submit" form="new-task" loading={start.isPending}>Start task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};
