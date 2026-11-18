const API_URL = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Every API call uses an absolute address from configuration — never a shared origin (§14.1). */
export const environments = {
  APP_NAME: "Agent Space",
  API_URL,
  /** Socket.IO origin (API_URL without the /api prefix). */
  REALTIME_URL: API_URL.replace(/\/api$/, ""),
  APP_URL: String(import.meta.env.VITE_APP_URL ?? ""),
};
