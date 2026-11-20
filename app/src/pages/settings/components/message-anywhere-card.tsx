import { useState, type FC } from "react";
import { Copy, Mail, MessageCircle, MessagesSquare, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { SettingsCard } from "@/components/ui/setting-row";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useChannels, useNewChannelCode, useNewEmailAddress, useRemoveChannel, useUpsertChannel } from "@/features/channels/hooks/use-channels";
import { ChannelLinkStatuses, ExternalChannels, type ChannelLink, type ExternalChannel } from "@/features/channels/interfaces/channels.interfaces";
import { ChannelOptions } from "@/config/constants/dropdowns/users/channel-form.options";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date";
import { platform } from "@/platform";

const ICONS: Record<ExternalChannel, LucideIcon> = { EMAIL: Mail, SLACK: MessagesSquare, WHATSAPP: MessageCircle };

const copy = (text: string) =>
  platform.clipboard.writeText(text).then(
    () => toast({ title: "Copied", duration: 1200 }),
    () => toast({ title: "Could not copy", variant: "error" }),
  );

const BotPicker: FC<{ value: string | undefined; onChange: (id: string) => void; disabled?: boolean; label: string }> = ({ value, onChange, disabled, label }) => {
  const { data: bots } = useBots();
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-[220px]" aria-label={label}>
        <SelectValue placeholder="Choose a bot" />
      </SelectTrigger>
      <SelectContent>
        {bots?.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ChannelRow: FC<{ option: (typeof ChannelOptions)[number]; link: ChannelLink | undefined; available: boolean }> = ({ option, link, available }) => {
  const { data: bots } = useBots();
  const upsert = useUpsertChannel();
  const newCode = useNewChannelCode();
  const newAddress = useNewEmailAddress();
  const remove = useRemoveChannel();
  const [botId, setBotId] = useState<string | undefined>(undefined);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmAddress, setConfirmAddress] = useState(false);
  const Icon = ICONS[option.id];
  const chosen = botId ?? bots?.[0]?.id;
  const pending = link?.status === ChannelLinkStatuses.PENDING;
  const codeExpired = pending && !link?.link_code;

  return (
    <div className="border-b border-hairline py-4 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-ink">{option.label}</span>
              {link?.status === ChannelLinkStatuses.ACTIVE && <Badge variant="secondary">On</Badge>}
              {pending && <Badge variant="outline">Waiting for the code</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{available ? option.description : "Not set up for Agent Space yet."}</p>
            {link?.linked_as && <p className="mt-0.5 text-[13px] text-muted-foreground">Linked as {link.linked_as}</p>}
            {link?.last_message_at && <p className="mt-0.5 text-[13px] text-muted-foreground">Last message {formatDateTime(link.last_message_at)}</p>}
          </div>
        </div>
        {available && (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {link ? (
              <BotPicker label={`${option.label} bot`} value={link.bot.id} disabled={upsert.isPending} onChange={(id) => upsert.mutate({ channel: option.id, bot_id: id })} />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <BotPicker label={`${option.label} bot`} value={chosen} onChange={setBotId} />
                <Button disabled={!chosen} loading={upsert.isPending} onClick={() => chosen && upsert.mutate({ channel: option.id, bot_id: chosen })}>
                  Turn on
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {link && option.id === ExternalChannels.EMAIL && link.address && (
        <div className="mt-3 rounded-md border border-hairline bg-muted/40 p-3">
          <p className="text-[13px] text-muted-foreground">{option.howTo}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 break-all text-sm font-semibold text-ink">{link.address}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Copy address" onClick={() => void copy(link.address!)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {link && pending && (
        <div className="mt-3 rounded-md border border-hairline bg-muted/40 p-3">
          {codeExpired ? (
            <p className="text-[13px] text-muted-foreground">The code expired. Get a new one to link your account.</p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                {option.howTo}
                {option.id === ExternalChannels.WHATSAPP ? ` ${link.address ?? "the Agent Space number"}.` : ""}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-2xl font-bold tracking-[0.2em] text-ink">{link.link_code}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Copy code" onClick={() => void copy(link.link_code!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {link.link_code_expires_at && <p className="mt-1 text-xs text-muted-foreground">Valid until {formatDateTime(link.link_code_expires_at)}. This page updates when it's linked.</p>}
            </>
          )}
        </div>
      )}

      {link && (
        <div className="mt-3 flex flex-wrap gap-2">
          {option.id === ExternalChannels.EMAIL ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setConfirmAddress(true)}>
              <RefreshCw className="h-4 w-4" /> New address
            </Button>
          ) : (
            (codeExpired || link.status === ChannelLinkStatuses.ACTIVE) && (
              <Button variant="outline" size="sm" className="gap-2" loading={newCode.isPending} onClick={() => newCode.mutate(option.id)}>
                <RefreshCw className="h-4 w-4" /> {codeExpired ? "New code" : "Link another account"}
              </Button>
            )
          )}
          <Button variant="outline" size="sm" onClick={() => setConfirmOff(true)}>
            Turn off
          </Button>
        </div>
      )}

      <ConfirmationDialog
        isOpen={confirmOff}
        onClose={() => setConfirmOff(false)}
        title={`Turn off ${option.label}?`}
        description="Messages sent there will no longer reach your bot. Your chat history stays in Agent Space."
        confirmText="Turn off"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(option.id, { onSuccess: () => setConfirmOff(false) })}
      />
      <ConfirmationDialog
        isOpen={confirmAddress}
        onClose={() => setConfirmAddress(false)}
        title="Get a new address?"
        description="The current address stops working straight away."
        confirmText="New address"
        isLoading={newAddress.isPending}
        onConfirm={() => newAddress.mutate(undefined, { onSuccess: () => setConfirmAddress(false) })}
      />
    </div>
  );
};

/** §16 Message from anywhere: talk to a bot by email, Slack or WhatsApp. Answers come back to the same place and the chat is kept in the app. */
export const MessageAnywhereCard: FC = () => {
  const { data, isPending } = useChannels();
  return (
    <SettingsCard title="Message from anywhere" description="Talk to one of your bots by email, Slack or WhatsApp. The answer comes back there, and the conversation is also kept in your chat with that bot.">
      {isPending ? (
        <div className="space-y-2 py-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        ChannelOptions.map((o) => <ChannelRow key={o.id} option={o} link={data?.links.find((l) => l.channel === o.id)} available={!!data?.available[o.id]} />)
      )}
    </SettingsCard>
  );
};
