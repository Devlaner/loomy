import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BoardWithMeta } from "@/lib/api";

export function useRecentBoards() {
  const [boards, setBoards] = useState<BoardWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/boards/recent");
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to load recent boards");
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

  const setBoardStarred = useCallback((boardId: string, starred: boolean) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === boardId ? { ...b, starred } : b)),
    );
  }, []);

  return { boards, loading, error, fetchRecentBoards, setBoardStarred };
}
