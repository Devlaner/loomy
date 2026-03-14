import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Tldraw, createTLStore, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { RemoteCursorsOverlay } from "@/components/board/RemoteCursorsOverlay";
import { useBoardContent } from "@/hooks/useBoardContent";
import { useBoardWebSocket } from "@/hooks/useBoardWebSocket";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

/** Editor type from tldraw onMount: store, inputs, pageToViewport */
type TldrawEditor = {
  store: ReturnType<typeof createTLStore>;
  inputs: { getCurrentPagePoint: () => { x: number; y: number } };
  pageToViewport: (p: { x: number; y: number }) => { x: number; y: number };
};

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [boardName, setBoardName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const [editor, setEditor] = useState<TldrawEditor | null>(null);
  const [store] = useState(() => createTLStore());

  // Ensure we have user for currentUserId (e.g. when opening board directly)
  useEffect(() => {
    if (!token || user) return;
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data)
          setUser({
            id: data.id,
            email: data.email,
            username: data.username,
            avatar_url: data.avatar_url ?? null,
          });
      })
      .catch(() => {});
  }, [token, user, setUser]);

  const {
    snapshot,
    loading: contentLoading,
    scheduleSave,
  } = useBoardContent(boardId ?? null);

  const onRemoteDocument = useCallback(
    (doc: unknown) => {
      if (doc && typeof doc === "object") {
        loadSnapshot(store, { document: doc } as Parameters<typeof loadSnapshot>[1]);
      }
    },
    [store],
  );

  const { remoteCursors, sendCursor } = useBoardWebSocket(boardId ?? null, token, {
    currentUserId: user?.id ?? null,
    onRemoteDocument,
  });

  const rafRef = useRef<number | null>(null);
  const sendCursorRef = useRef(sendCursor);
  sendCursorRef.current = sendCursor;

  useEffect(() => {
    if (!boardId || !token) return;
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
    (editorInstance: TldrawEditor) => {
      setEditor(editorInstance);
      const unsub = editorInstance.store.listen(
        () => {
          const snap = getSnapshot(editorInstance.store);
          if (snap.document) {
            scheduleSave({ document: snap.document });
          }
        },
        { source: "user", scope: "document" },
      );

      // Send cursor position on pointer move (throttled inside hook)
      const onPointerMove = () => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const pt = editorInstance.inputs.getCurrentPagePoint();
          sendCursorRef.current(pt.x, pt.y);
        });
      };
      const canvas = document.querySelector(".tl-canvas");
      canvas?.addEventListener("pointermove", onPointerMove);

      return () => {
        unsub();
        canvas?.removeEventListener("pointermove", onPointerMove);
        setEditor(null);
      };
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
      <div className="flex-1 min-h-0 relative">
        {contentLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[var(--text-muted)]">Loading canvas...</div>
          </div>
        ) : (
          <>
            <Tldraw key={boardId} store={store} onMount={handleMount} />
            <RemoteCursorsOverlay editor={editor} cursors={remoteCursors} />
          </>
        )}
      </div>
    </div>
  );
}
