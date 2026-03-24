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

/** Base URL for WebSocket (ws or wss from http or https). */
export function getWsBaseUrl(): string {
  const url = API_BASE.trim();
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return `ws://${url}`;
}

/** WebSocket URL for a board: /api/ws/boards/{boardId}?token=... */
export function getBoardWsUrl(boardId: string, token: string): string {
  const base = getWsBaseUrl().replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  return `${base}/api/ws/boards/${boardId}?${params.toString()}`;
}

function getToken(): string | null {
  return useAuthStore.getState().token;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
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
