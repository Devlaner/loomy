import { useCallback, useState } from "react";
import { apiFetch, type Board, type BoardListResponse } from "@/lib/api";

export function useBoards(workspaceId: string | null) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    if (!workspaceId) {
      setBoards([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/boards?workspace_id=${workspaceId}&page=1&limit=50`,
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to load boards");
        return;
      }
      const data: BoardListResponse = await res.json();
      setBoards(data.items);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createBoard = useCallback(
    async (name: string): Promise<Board | null> => {
      if (!workspaceId) return null;
      setError(null);
      try {
        const res = await apiFetch("/api/boards", {
          method: "POST",
          body: JSON.stringify({ name, workspace_id: workspaceId }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to create board");
          return null;
        }
        const board: Board = await res.json();
        setBoards((prev) => [board, ...prev]);
        return board;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [workspaceId],
  );

  const updateBoard = useCallback(
    async (boardId: string, name: string): Promise<Board | null> => {
      setError(null);
      try {
        const res = await apiFetch(`/api/boards/${boardId}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to update board");
          return null;
        }
        const board: Board = await res.json();
        setBoards((prev) => prev.map((b) => (b.id === boardId ? board : b)));
        return board;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [],
  );

  const deleteBoard = useCallback(async (boardId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiFetch(`/api/boards/${boardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to delete board");
        return false;
      }
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      return true;
    } catch {
      setError("Network error");
      return false;
    }
  }, []);

  const createBoardFromTemplate = useCallback(
    async (name: string, templateSlug: string): Promise<Board | null> => {
      if (!workspaceId) return null;
      setError(null);
      try {
        const res = await apiFetch("/api/boards/from-template", {
          method: "POST",
          body: JSON.stringify({
            workspace_id: workspaceId,
            template_slug: templateSlug,
            name: name || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to create board");
          return null;
        }
        const board: Board = await res.json();
        setBoards((prev) => [board, ...prev]);
        return board;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [workspaceId],
  );

  const duplicateBoard = useCallback(
    async (boardId: string): Promise<Board | null> => {
      if (!workspaceId) return null;
      setError(null);
      try {
        const res = await apiFetch(`/api/boards/${boardId}/duplicate`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to duplicate board");
          return null;
        }
        const board: Board = await res.json();
        setBoards((prev) => [board, ...prev]);
        return board;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [workspaceId],
  );

  return {
    boards,
    loading,
    error,
    fetchBoards,
    createBoard,
    createBoardFromTemplate,
    updateBoard,
    deleteBoard,
    duplicateBoard,
  };
}
