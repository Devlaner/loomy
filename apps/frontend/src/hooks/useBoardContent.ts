import { useCallback, useEffect, useRef, useState } from "react";
import type { TLEditorSnapshot } from "tldraw";
import { apiFetch } from "@/lib/api";

const SNAPSHOT_TYPE = "tldraw_snapshot";

export function useBoardContent(boardId: string | null) {
  const [snapshot, setSnapshot] = useState<Partial<TLEditorSnapshot> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadContent = useCallback(async () => {
    if (!boardId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/elements?board_id=${boardId}&page=1&limit=500`,
      );
      if (!res.ok) {
        setError("Failed to load board");
        return;
      }
      const data = await res.json();
      const snapshotEl = data.items?.find(
        (e: { type: string }) => e.type === SNAPSHOT_TYPE,
      );
      if (snapshotEl?.data?.document) {
        setSnapshot(snapshotEl.data as Partial<TLEditorSnapshot>);
      } else {
        setSnapshot(null);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const saveContent = useCallback(
    async (content: Partial<TLEditorSnapshot>) => {
      if (!boardId) return;
      try {
        const listRes = await apiFetch(
          `/api/elements?board_id=${boardId}&page=1&limit=500`,
        );
        if (!listRes.ok) return;
        const listData = await listRes.json();
        const existing = listData.items?.find(
          (e: { type: string }) => e.type === SNAPSHOT_TYPE,
        );

        if (existing) {
          await apiFetch(`/api/elements/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ data: content }),
          });
        } else {
          await apiFetch("/api/elements", {
            method: "POST",
            body: JSON.stringify({
              board_id: boardId,
              type: SNAPSHOT_TYPE,
              data: content,
            }),
          });
        }
      } catch {
        // Silent fail for auto-save
      }
    },
    [boardId],
  );

  const scheduleSave = useCallback(
    (content: Partial<TLEditorSnapshot>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(content);
        saveTimeoutRef.current = null;
      }, 1000);
    },
    [saveContent],
  );

  useEffect(() => {
    loadContent();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadContent]);

  return {
    snapshot,
    loading,
    error,
    loadContent,
    saveContent,
    scheduleSave,
  };
}
