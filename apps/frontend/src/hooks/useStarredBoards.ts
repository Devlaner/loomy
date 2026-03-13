import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BoardWithMeta } from "@/lib/api";

export function useStarredBoards() {
  const [boards, setBoards] = useState<BoardWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStarredBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/boards/starred");
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to load starred boards");
        return;
      }
      const data = await res.json();
      setBoards(data.items || []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  const starBoard = useCallback(
    async (boardId: string) => {
      const res = await apiFetch(`/api/boards/${boardId}/star`, {
        method: "POST",
      });
      if (res.ok) fetchStarredBoards();
    },
    [fetchStarredBoards],
  );

  const unstarBoard = useCallback(async (boardId: string) => {
    const res = await apiFetch(`/api/boards/${boardId}/star`, {
      method: "DELETE",
    });
    if (res.ok) setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }, []);

  return {
    boards,
    loading,
    error,
    fetchStarredBoards,
    starBoard,
    unstarBoard,
  };
}
