import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { apiFetch, formatApiError } from "@/lib/api";

export interface ShareToken {
  id: string;
  board_id: string;
  token: string;
  url: string;
  role: "viewer" | "editor";
  created_at: string;
  expires_at: string | null;
}

interface ShareDialogProps {
  boardId: string;
  onClose: () => void;
}

export function ShareDialog({ boardId, onClose }: ShareDialogProps) {
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/boards/${boardId}/share-tokens`);
      if (!res.ok) {
        setError("Failed to load share links");
        return;
      }
      const body = await res.json();
      setTokens(body.items ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function createLink() {
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/boards/${boardId}/share-tokens`, {
        method: "POST",
        body: JSON.stringify({ role: "viewer" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(formatApiError(body.detail, "Failed to create share link"));
        return;
      }
      const created: ShareToken = await res.json();
      setTokens((prev) => [created, ...prev]);
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      const res = await apiFetch(`/api/boards/${boardId}/share-tokens/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Failed to revoke link");
        return;
      }
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Network error");
    }
  }

  async function copy(token: ShareToken) {
    try {
      await navigator.clipboard.writeText(token.url);
      setCopiedId(token.id);
      setTimeout(
        () => setCopiedId((id) => (id === token.id ? null : id)),
        1500,
      );
    } catch {
      // clipboard may be unavailable (insecure origin, etc.) — fall back
      // silently; the URL is still visible in the row.
    }
  }

  return (
    <Modal title="Share this board" onClose={onClose}>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Anyone with a share link can view this board without a Loomy account.
      </p>
      <Button onClick={createLink} disabled={creating} fullWidth size="md">
        {creating ? "Creating..." : "Create new link"}
      </Button>
      {error && <p className="text-sm text-[var(--error)] mt-3">{error}</p>}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No active share links yet.
          </p>
        ) : (
          tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 p-2 border border-[var(--border)] rounded"
            >
              <code className="flex-1 text-xs truncate text-[var(--text-primary)]">
                {t.url}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(t)}
                type="button"
              >
                {copiedId === t.id ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke(t.id)}
                type="button"
              >
                Revoke
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
