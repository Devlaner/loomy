import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";

export interface BoardComment {
  id: string;
  board_id: string;
  parent_id: string | null;
  author_id: string;
  author_username: string | null;
  body: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentsPaneProps {
  boardId: string;
  currentUserId: string | null;
  onClose: () => void;
  subscribeToBoardEvent?: (
    handler: (event: string, data: Record<string, unknown>) => void,
  ) => () => void;
}

type CommentNode = BoardComment & { replies: CommentNode[] };

function buildTree(flat: BoardComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  flat.forEach((c) => byId.set(c.id, { ...c, replies: [] }));
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  roots.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return roots;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function CommentsPane({
  boardId,
  currentUserId,
  onClose,
  subscribeToBoardEvent,
}: CommentsPaneProps) {
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/boards/${boardId}/comments`);
      if (!res.ok) {
        setError("Failed to load comments");
        return;
      }
      const body = await res.json();
      setComments(body.items ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!subscribeToBoardEvent) return;
    const unsub = subscribeToBoardEvent((event, data) => {
      if (event === "comment.created" || event === "comment.updated") {
        const incoming = data as unknown as BoardComment;
        if (!incoming.id) return;
        setComments((prev) => {
          const idx = prev.findIndex((c) => c.id === incoming.id);
          if (idx === -1) return [...prev, incoming];
          const next = prev.slice();
          next[idx] = incoming;
          return next;
        });
      } else if (event === "comment.deleted") {
        const id = typeof data.id === "string" ? data.id : null;
        if (!id) return;
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    });
    return unsub;
  }, [subscribeToBoardEvent]);

  const tree = useMemo(() => buildTree(comments), [comments]);

  async function submit(body: string, parentId: string | null) {
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: trimmed, parent_id: parentId }),
      });
      if (!res.ok) {
        setError("Failed to post comment");
        return;
      }
      const created: BoardComment = await res.json();
      setComments((prev) => [...prev, created]);
      if (parentId) {
        setReplyingTo(null);
        setReplyBody("");
      } else {
        setNewBody("");
      }
    } catch {
      setError("Network error");
    }
  }

  async function toggleResolved(c: BoardComment) {
    const next = c.resolved_at === null;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/comments/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ resolved: next }),
      });
      if (!res.ok) return;
      const updated: BoardComment = await res.json();
      setComments((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
    } catch {
      /* ignore */
    }
  }

  async function remove(c: BoardComment) {
    try {
      const res = await apiFetch(`/api/boards/${boardId}/comments/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } catch {
      /* ignore */
    }
  }

  function renderNode(node: CommentNode, depth: number) {
    const canEdit = currentUserId === node.author_id;
    const resolved = node.resolved_at !== null;
    return (
      <div
        key={node.id}
        className={`border-l-2 pl-3 ${
          resolved
            ? "border-[var(--border)] opacity-60"
            : "border-[var(--accent)]"
        }`}
        style={{ marginLeft: depth * 12 }}
      >
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            {node.author_username ?? "Someone"}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatRelative(node.created_at)}
          </span>
          {resolved && (
            <span className="text-xs text-[var(--text-muted)]">resolved</span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
          {node.body}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() =>
              setReplyingTo((id) => (id === node.id ? null : node.id))
            }
            className="hover:text-[var(--text-primary)]"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => toggleResolved(node)}
            className="hover:text-[var(--text-primary)]"
          >
            {resolved ? "Reopen" : "Resolve"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => remove(node)}
              className="hover:text-[var(--error)]"
            >
              Delete
            </button>
          )}
        </div>
        {replyingTo === node.id && (
          <div className="mt-2 space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              className="w-full text-sm p-2 border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
              placeholder="Reply..."
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => submit(replyBody, node.id)}
              >
                Post reply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyBody("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {node.replies.map((r) => renderNode(r, depth + 1))}
      </div>
    );
  }

  return (
    <aside className="w-80 shrink-0 h-full border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Comments
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No comments yet. Leave the first one below.
          </p>
        ) : (
          tree.map((n) => renderNode(n, 0))
        )}
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      </div>
      <div className="shrink-0 p-4 border-t border-[var(--border)] space-y-2">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          className="w-full text-sm p-2 border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
          placeholder="Leave a comment..."
        />
        <Button
          type="button"
          fullWidth
          size="sm"
          onClick={() => submit(newBody, null)}
        >
          Post
        </Button>
      </div>
    </aside>
  );
}
