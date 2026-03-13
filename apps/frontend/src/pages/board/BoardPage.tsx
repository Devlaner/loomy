import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Tldraw, createTLStore, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { useBoardContent } from "@/hooks/useBoardContent";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [boardName, setBoardName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const [store] = useState(() => createTLStore());

  const {
    snapshot,
    loading: contentLoading,
    scheduleSave,
  } = useBoardContent(boardId ?? null);

  useEffect(() => {
    if (!boardId) {
      navigate("/dashboard");
      return;
    }
    if (!token) {
      navigate("/login");
      return;
    }
    apiFetch(`/api/boards/${boardId}`)
      .then((res) => {
        if (!res.ok) {
          navigate("/dashboard");
          return;
        }
        return res.json();
      })
      .then(async (data) => {
        if (data) {
          setBoardName(data.name);
          await apiFetch(`/api/boards/${boardId}/open`, { method: "POST" });
        }
        setAuthChecked(true);
      })
      .catch(() => navigate("/dashboard"));
  }, [boardId, token, navigate]);

  useEffect(() => {
    if (snapshot?.document) {
      loadSnapshot(store, snapshot);
    }
  }, [snapshot, store]);

  const handleMount = useCallback(
    (editor: { store: ReturnType<typeof createTLStore> }) => {
      const unsub = editor.store.listen(
        () => {
          const snap = getSnapshot(editor.store);
          if (snap.document) {
            scheduleSave({ document: snap.document });
          }
        },
        { source: "user", scope: "document" },
      );
      return unsub;
    },
    [scheduleSave],
  );

  if (!authChecked || !boardId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg-primary)]">
      <PageTitle title={boardName || "Board"} />
      <header className="h-12 shrink-0 flex items-center gap-4 px-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <Link
          to="/dashboard"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          ← Dashboard
        </Link>
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {boardName || "Board"}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        {contentLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[var(--text-muted)]">Loading canvas...</div>
          </div>
        ) : (
          <Tldraw key={boardId} store={store} onMount={handleMount} />
        )}
      </div>
    </div>
  );
}
