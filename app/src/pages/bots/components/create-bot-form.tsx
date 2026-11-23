import { useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarPicker } from "@/components/avatar-picker/avatar-picker";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { NewChatStepLayout, type NewChatStepProps } from "@/components/layout/new-chat/new-chat-step";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useCreateBot } from "@/features/bots/hooks/use-bots";
import { useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import { BotColorOptions } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { randomAvatarSeed } from "@/components/ui/bot-portrait";
import { quickBotSchema, type QuickBotFormValues } from "../validation-schemas/bot.schema";
import { Routes } from "@/routes/routes";

const FORM_ID = "create-bot-quick";
/** A random face and colour so every new bot starts out different. */
const defaultValues = (): QuickBotFormValues => ({ name: "", avatar_seed: randomAvatarSeed(), color: BotColorOptions[Math.floor(Math.random() * BotColorOptions.length)].id });

/**
 * "New bot" step of the new-chat modal: name, avatar and colour only. Everything else uses the API defaults and is
 * editable later from the bot page. On success it opens a direct chat with the new bot.
 */
export const CreateBotForm: FC<NewChatStepProps> = ({ onDone, onBack, closeRef }) => {
  const navigate = useNavigate();
  const createBot = useCreateBot();
  const openDirect = useOpenDirect();
  const pending = createBot.isPending || openDirect.isPending;
  const form = useForm<QuickBotFormValues>({ resolver: zodResolver(quickBotSchema), defaultValues: defaultValues() });
  const [name, avatarSeed, color] = useWatch({ control: form.control, name: ["name", "avatar_seed", "color"] });
  const { requestClose, requestLeave, dialogProps } = useUnsavedChangesGuard({ isDirty: form.formState.isDirty, disabled: pending, onClose: onDone });

  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  const submit = form.handleSubmit((v) =>
    createBot.mutate(
      { name: v.name, avatar_seed: v.avatar_seed, color: v.color },
      {
        onSuccess: (bot) =>
          openDirect.mutate(
            { bot_id: bot.id },
            {
              onSuccess: (c) => {
                onDone();
                navigate(Routes.chat.conversation(c.id));
              },
            },
          ),
      },
    ),
  );

  return (
    <NewChatStepLayout
      title="Create new bot"
      description="Pick a name, an avatar and a colour. You can set up instructions and tools later."
      hideDescription
      onBack={onBack && (() => requestLeave(onBack))}
      footer={
        <>
          <Button variant="outline" className="rounded-full" onClick={requestClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full" loading={pending} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={submit} className="flex flex-col items-center gap-6">
          <AvatarPicker seed={avatarSeed} color={color} size={88} name={name || "New bot"} className="rounded-full" onSeedChange={(seed) => form.setValue("avatar_seed", seed, { shouldDirty: true })} onColorChange={(c) => form.setValue("color", c, { shouldDirty: true })} />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input placeholder="Name your bot" aria-label="Bot name" autoFocus autoComplete="off" maxLength={60} className="h-12 text-center text-base" {...field} />
                </FormControl>
                <FormMessage className="text-center" />
              </FormItem>
            )}
          />

        </form>
      </Form>
      <UnsavedChangesDialog {...dialogProps} />
    </NewChatStepLayout>
  );
};
