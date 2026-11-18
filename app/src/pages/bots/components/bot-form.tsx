import type { FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { botFormSchema, type BotFormValues } from "../validation-schemas/bot.schema";
import { ColorSwatches, EmojiPicker, ModelSelect } from "./bot-pickers";

interface BotFormProps {
  defaultValues: BotFormValues;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (v: BotFormValues) => void;
  onBack?: () => void;
}

/** The short bot form (§6.1 "Filling in a short form"), also used to review a drafted bot. */
export const BotForm: FC<BotFormProps> = ({ defaultValues, submitLabel, loading, onSubmit, onBack }) => {
  const form = useForm<BotFormValues>({ resolver: zodResolver(botFormSchema), defaultValues });
  const color = form.watch("color");
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center gap-4">
          <FormField control={form.control} name="emoji" render={({ field }) => <EmojiPicker value={field.value} color={color} onChange={field.onChange} />} />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Sales Sam" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colour</FormLabel>
              <ColorSwatches value={field.value} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>One-line description</FormLabel>
              <FormControl>
                <Input placeholder="Preps me for calls and keeps HubSpot updated" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea rows={7} placeholder="You are a sharp, upbeat sales assistant…" {...field} />
              </FormControl>
              <FormDescription>Role, goals, rules and tone in plain language.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AI model</FormLabel>
              <ModelSelect value={field.value} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
              Back
            </Button>
          )}
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
