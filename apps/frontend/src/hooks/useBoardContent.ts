import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const SNAPSHOT_TYPE = "excalidraw_snapshot";

export type ExcalidrawSnapshot = {
  elements?: readonly unknown[] | null;
  appState?: Readonly<Record<string, unknown>> | null;
  // Authoritative shared state when present (base64 Yjs update).
  // Legacy boards have only `elements`/`appState`.
  yjs_update?: string | null;
};

export function useBoardContent(boardId: string | null) {
  const [snapshot, setSnapshot] = useState<ExcalidrawSnapshot | null>(null);
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
      if (
        snapshotEl?.data?.elements != null ||
        snapshotEl?.data?.appState != null
      ) {
        setSnapshot(snapshotEl.data as ExcalidrawSnapshot);
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
    async (content: ExcalidrawSnapshot) => {
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

  // Accept either a value or a lazy getter. The getter is resolved at
  // save time, so callers can skip expensive work (e.g. encoding the
  // full Y.Doc) until the debounce window actually fires.
  const scheduleSave = useCallback(
    (
      contentOrGetter:
        | ExcalidrawSnapshot
        | (() => ExcalidrawSnapshot | null | undefined),
    ) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const content =
          typeof contentOrGetter === "function"
            ? contentOrGetter()
            : contentOrGetter;
        if (content) saveContent(content);
      }, 1000);
    },
    [saveContent],
  );

  const clearPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

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
    clearPendingSave,
  };
}
