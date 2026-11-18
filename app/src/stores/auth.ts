import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { User } from "@/features/users/interfaces/users.interfaces";

const STORE_KEY = "auth";

export const AuthStatuses = { UNKNOWN: "unknown", SIGNED_IN: "signed_in", SIGNED_OUT: "signed_out" } as const;
export type AuthStatus = (typeof AuthStatuses)[keyof typeof AuthStatuses];

interface AuthStore {
  status: AuthStatus;
  /** Access token lives in memory only; the refresh token is an httpOnly cookie on web (§14.1). */
  access_token: string | null;
  expires_in: number | null;
  user: User | null;
  setSession: (s: { access_token: string; expires_in: number; user?: User }) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

// Not persisted: sign-in data never goes to localStorage on web. A reload re-establishes the session via the refresh cookie.
export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      status: AuthStatuses.UNKNOWN,
      access_token: null,
      expires_in: null,
      user: null,
      setSession: ({ access_token, expires_in, user }) => set((s) => ({ status: AuthStatuses.SIGNED_IN, access_token, expires_in, user: user ?? s.user })),
      setUser: (user) => set({ user }),
      clear: () => set({ status: AuthStatuses.SIGNED_OUT, access_token: null, expires_in: null, user: null }),
    }),
    { name: STORE_KEY },
  ),
);

export const getAuthStoreState = () => useAuthStore.getState();
