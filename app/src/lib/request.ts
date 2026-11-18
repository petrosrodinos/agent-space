import { apiErrorMessage } from "@/config/api/axios";

/** Wraps a service call: returns `response.data`, throws a human-readable Error. */
export async function request<T>(call: () => Promise<{ data: T }>, fallback?: string): Promise<T> {
  try {
    const res = await call();
    return res.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, fallback));
  }
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; total_pages: number; has_next: boolean; has_prev: boolean };
}
