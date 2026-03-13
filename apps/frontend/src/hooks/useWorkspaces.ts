import { useCallback, useState } from "react";
import {
  apiFetch,
  type Workspace,
  type WorkspaceListResponse,
} from "@/lib/api";

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/workspaces?page=1&limit=50");
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to load workspaces");
        return;
      }
      const data: WorkspaceListResponse = await res.json();
      setWorkspaces(data.items);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(
    async (name: string): Promise<Workspace | null> => {
      setError(null);
      try {
        const res = await apiFetch("/api/workspaces", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to create workspace");
          return null;
        }
        const workspace: Workspace = await res.json();
        setWorkspaces((prev) => [workspace, ...prev]);
        return workspace;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [],
  );

  const updateWorkspace = useCallback(
    async (workspaceId: string, name: string): Promise<Workspace | null> => {
      setError(null);
      try {
        const res = await apiFetch(`/api/workspaces/${workspaceId}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to update workspace");
          return null;
        }
        const workspace: Workspace = await res.json();
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? workspace : w)),
        );
        return workspace;
      } catch {
        setError("Network error");
        return null;
      }
    },
    [],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await apiFetch(`/api/workspaces/${workspaceId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Failed to delete workspace");
          return false;
        }
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        return true;
      } catch {
        setError("Network error");
        return false;
      }
    },
    [],
  );

  return {
    workspaces,
    loading,
    error,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };
}
