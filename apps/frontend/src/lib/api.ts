/**
 * Format FastAPI error detail for display.
 * Handles string, array of validation errors, or unknown shape.
 */
export function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String(item.msg)
          : null,
      )
      .filter(Boolean);
    return messages.length > 0 ? messages.join(". ") : fallback;
  }
  return fallback;
}

import { useAuthStore } from "@/stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function getWsBaseUrl(): string {
  const url = API_BASE.trim();
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return `ws://${url}`;
}

export function getBoardWsUrl(boardId: string): string {
  const base = getWsBaseUrl().replace(/\/$/, "");
  return `${base}/api/ws/boards/${boardId}`;
}

function getToken(): string | null {
  return useAuthStore.getState().token;
}

function buildHeaders(
  extra: HeadersInit | undefined,
  token: string | null,
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((extra as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Coalesce concurrent refreshes: refresh tokens rotate on every use,
// so parallel calls would invalidate each other.
let refreshInFlight: Promise<string | null> | null = null;

const REFRESH_NETWORK_RETRY_DELAY_MS = 500;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const run = async (): Promise<string | null> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return null;

    const attemptRefresh = () =>
      fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

    let res: Response;
    try {
      res = await attemptRefresh();
    } catch {
      // A thrown fetch error here is a network-level failure (offline,
      // DNS, server unreachable) -- distinct from a confirmed-invalid
      // session (explicit non-2xx below). Retry once after a short delay:
      // most real-world blips are transient, and treating this the same
      // as an explicit 401 would log the user out over a flaky connection.
      await new Promise((r) => setTimeout(r, REFRESH_NETWORK_RETRY_DELAY_MS));
      try {
        res = await attemptRefresh();
      } catch {
        // Still a network-level failure: leave auth state untouched. We
        // deliberately do NOT call logout() here -- the session hasn't
        // been confirmed invalid, only unreachable.
        return null;
      }
    }

    if (!res.ok) {
      // A real response from the server saying the refresh token itself
      // is invalid/expired -- this is a confirmed-dead session.
      useAuthStore.getState().logout();
      return null;
    }
    const data: {
      access_token?: string;
      refresh_token?: string | null;
    } = await res.json();
    if (!data.access_token) {
      useAuthStore.getState().logout();
      return null;
    }
    useAuthStore.getState().setTokens({
      token: data.access_token,
      refreshToken: data.refresh_token ?? null,
    });
    return data.access_token;
  };

  refreshInFlight = run().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function logoutAndClear(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Clear locally even if the server call fails; refresh TTL bounds damage.
    }
  }
  useAuthStore.getState().logout();
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options.headers, token),
  });

  // Skip the refresh path itself to avoid infinite recursion.
  if (
    response.status === 401 &&
    !path.startsWith("/api/auth/refresh") &&
    useAuthStore.getState().refreshToken
  ) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: buildHeaders(options.headers, fresh),
      });
    }
  }

  return response;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  owner_username?: string;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  owner_username?: string;
  owner_display_name?: string | null;
  owner_avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardWithMeta extends Board {
  last_opened_at?: string | null;
  starred?: boolean;
}

export interface WorkspaceListResponse {
  items: Workspace[];
  total: number;
  page: number;
  limit: number;
}

export interface BoardListResponse {
  items: Board[];
  total: number;
  page: number;
  limit: number;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: string;
  token: string;
  invite_url: string;
  created_at: string;
  expires_at?: string | null;
  accepted_at?: string | null;
}

export interface WorkspaceInvitationListResponse {
  items: WorkspaceInvitation[];
}
