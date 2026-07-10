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
  // Short-lived access token only. The refresh token lives exclusively
  // in an httpOnly cookie set by the backend -- it's never readable by
  // JS, so it has no place in this client-side store.
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "loomy-auth",
      partialize: (s) => ({ token: s.token }),
    },
  ),
);
