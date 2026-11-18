import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { environments } from "@/config/environments";
import { ApiRoutes } from "@/config/api/routes";
import { getAuthStoreState } from "@/stores/auth";
import { getOrganizationStoreState } from "@/stores/organization";
import { platform } from "@/platform";
import { RefreshTokenModes, AXIOS_NETWORK_ERROR } from "@/config/constants/browser.constants";

const axiosInstance = axios.create({
  baseURL: environments.API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json", "X-Client-Platform": platform.appInfo.platform, "X-App-Version": platform.appInfo.version },
});

/** One refresh at a time; concurrent 401s wait for the same promise. */
let refreshing: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      // Only an explicit rejection (401/400) signs the user out; network errors (offline, API restarting) are retried.
      for (let attempt = 0; ; attempt++) {
        try {
          const refresh_token = platform.storage.refreshTokenMode === RefreshTokenModes.SECURE ? await platform.storage.getRefreshToken() : undefined;
          const { data } = await axios.post(`${environments.API_URL}${ApiRoutes.auth.refresh}`, refresh_token ? { refresh_token } : {}, {
            withCredentials: true,
            headers: { "X-Client-Platform": platform.appInfo.platform },
          });
          if (data.refresh_token) await platform.storage.setRefreshToken(data.refresh_token);
          getAuthStoreState().setSession({ access_token: data.access_token, expires_in: data.expires_in, user: data.user });
          return data.access_token as string;
        } catch (e) {
          const status = (e as AxiosError).response?.status;
          const transient = !status || status >= 500 || status === 429;
          if (!transient || attempt >= 8) {
            getAuthStoreState().clear();
            return null;
          }
          await new Promise((r) => setTimeout(r, Math.min(8000, 800 * 2 ** attempt)));
        }
      }
    })().finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  }
  return refreshing;
}

const expiresSoon = (exp: number | null) => !!exp && exp * 1000 - Date.now() < 30_000;

axiosInstance.interceptors.request.use(async (config) => {
  const auth = getAuthStoreState();
  let token = auth.access_token;
  if (token && expiresSoon(auth.expires_in)) token = await refreshSession();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const org = getOrganizationStoreState().current_id;
  if (org && !config.headers["X-Organization-Id"]) config.headers["X-Organization-Id"] = org;
  return config;
});

axiosInstance.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url ?? "";
    if (error.response?.status === 401 && original && !original._retried && !url.includes("/auth/")) {
      original._retried = true;
      const token = await refreshSession();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error (NestJS `{ message }` or validation arrays). */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = error as AxiosError<{ message?: string | string[] }>;
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(". ");
  if (typeof m === "string" && m) return m;
  if (e?.message === AXIOS_NETWORK_ERROR) return "Can't reach Agent Space. Check your connection.";
  return fallback;
}

export default axiosInstance;
