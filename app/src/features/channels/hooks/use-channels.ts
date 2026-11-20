import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useOrganizationStore } from "@/stores/organization";
import { QueryKeys } from "@/config/constants/query-keys";
import { getChannels, newChannelCode, newEmailAddress, removeChannel, upsertChannel } from "../services/channels.services";
import { ChannelLinkStatuses, type ChannelsOverview } from "../interfaces/channels.interfaces";

/** While a Slack / WhatsApp link waits for its code, check every few seconds so the card turns "Linked" by itself. */
const PENDING_POLL_MS = 4000;

export const useChannels = () => {
  const org = useOrganizationStore((s) => s.current_id);
  return useQuery({
    queryKey: [QueryKeys.CHANNELS, org],
    queryFn: getChannels,
    enabled: !!org,
    refetchInterval: (q) => ((q.state.data as ChannelsOverview | undefined)?.links.some((l) => l.status === ChannelLinkStatuses.PENDING && l.link_code) ? PENDING_POLL_MS : false),
  });
};

const useChannelMutation = <T, R = unknown>(fn: (v: T) => Promise<R>, success: string, fail: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QueryKeys.CHANNELS] });
      toast({ title: success, duration: 1800 });
    },
    onError: (e: Error) => toast({ title: fail, description: e.message, variant: "error" }),
  });
};

export const useUpsertChannel = () => useChannelMutation(upsertChannel, "Saved", "Could not save");
export const useNewChannelCode = () => useChannelMutation(newChannelCode, "New code ready", "Could not get a new code");
export const useNewEmailAddress = () => useChannelMutation(newEmailAddress, "New address ready — the old one no longer works", "Could not change the address");
export const useRemoveChannel = () => useChannelMutation(removeChannel, "Turned off", "Could not turn it off");
