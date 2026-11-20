import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { CreateWidgetDto, UpdateWidgetDto, Widget } from "../interfaces/widgets.interfaces";

const R = ApiRoutes.widgets;

/** Refreshing asks the bot for fresh data with its tools, which can take a while. */
const REFRESH_TIMEOUT_MS = 180_000;

export const getWidgets = () => request<Widget[]>(() => axiosInstance.get(R.root));
export const getWidget = (id: string) => request<Widget>(() => axiosInstance.get(R.one(id)));
export const createWidget = (dto: CreateWidgetDto) => request<Widget>(() => axiosInstance.post(R.root, dto));
export const updateWidget = ({ id, ...dto }: UpdateWidgetDto & { id: string }) => request<Widget>(() => axiosInstance.patch(R.one(id), dto));
export const deleteWidget = (id: string) => request<{ ok: boolean }>(() => axiosInstance.delete(R.one(id)));
export const refreshWidget = (id: string) => request<Widget>(() => axiosInstance.post(R.refresh(id), undefined, { timeout: REFRESH_TIMEOUT_MS }));
