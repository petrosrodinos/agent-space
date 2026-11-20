import { ExternalChannels, type ExternalChannel } from "@/features/channels/interfaces/channels.interfaces";

/** Settings → Message from anywhere (§16): the text for each channel. */
export const ChannelOptions: readonly { id: ExternalChannel; label: string; description: string; howTo: string }[] = [
  {
    id: ExternalChannels.EMAIL,
    label: "Email",
    description: "Email your bot from your own address and get the answer by email.",
    howTo: "Send email from your account address to this address. Only emails from you are accepted.",
  },
  {
    id: ExternalChannels.SLACK,
    label: "Slack",
    description: "Send the Agent Space app a direct message in Slack.",
    howTo: "Open a direct message with the Agent Space app in Slack and send this code.",
  },
  {
    id: ExternalChannels.WHATSAPP,
    label: "WhatsApp",
    description: "Message your bot on WhatsApp.",
    howTo: "Send this code on WhatsApp to",
  },
] as const;
