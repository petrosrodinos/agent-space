import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { ChannelLink, ChannelsOverview, ExternalChannel } from "../interfaces/channels.interfaces";

const R = ApiRoutes.channels;

export const getChannels = () => request<ChannelsOverview>(() => axiosInstance.get(R.root));
export const upsertChannel = ({ channel, bot_id }: { channel: ExternalChannel; bot_id: string }) => request<ChannelLink>(() => axiosInstance.put(R.one(channel), { bot_id }));
export const newChannelCode = (channel: ExternalChannel) => request<ChannelLink>(() => axiosInstance.post(R.code(channel)));
export const newEmailAddress = () => request<ChannelLink>(() => axiosInstance.post(R.emailAddress));
export const removeChannel = (channel: ExternalChannel) => request<{ ok: boolean }>(() => axiosInstance.delete(R.one(channel)));
