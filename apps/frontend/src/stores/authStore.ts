import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  email_verified?: boolean;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setTokens: (tokens: {
    token: string | null;
    refreshToken?: string | null;
  }) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setTokens: ({ token, refreshToken }) =>
        set((s) => ({
          token,
          refreshToken:
            refreshToken === undefined ? s.refreshToken : refreshToken,
        })),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: "loomy-auth",
      partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken }),
    },
  ),
);
