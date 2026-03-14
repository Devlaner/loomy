import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "@/styles/excalidraw-board.css";

/** Minimal type for Excalidraw API (getAppState, updateScene, onChange, onScrollChange) */
type ExcalidrawAPI = Parameters<
  NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];
import { PageTitle } from "@/components/PageTitle";
import { RemoteCursorsOverlay } from "@/components/board/RemoteCursorsOverlay";
import { useBoardContent } from "@/hooks/useBoardContent";
import type { ExcalidrawSnapshot } from "@/hooks/useBoardContent";
import { useBoardWebSocket } from "@/hooks/useBoardWebSocket";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch } from "@/lib/api";

/** Map platform theme to Excalidraw theme (Excalidraw only supports light/dark) */
function getExcalidrawTheme(
  theme: "light" | "dark" | "soft",
): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

/** Normalize loaded appState so Excalidraw doesn't crash: collaborators must be a Map, not a plain object (JSON). */
function normalizeAppStateForExcalidraw(
  appState: unknown,
): Record<string, unknown> | undefined {
  if (appState == null || typeof appState !== "object") return undefined;
  const raw = appState as Record<string, unknown>;
  const collaborators = raw.collaborators;
  const isMap = collaborators instanceof Map;
  return {
    ...raw,
    collaborators: isMap ? collaborators : new Map(),
  } as Record<string, unknown>;
}

/** Viewport state for cursor overlay (scroll + zoom + offset) */
export type ExcalidrawViewportState = {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  offsetLeft: number;
  offsetTop: number;
};

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    toggleTheme: false,
    loadScene: false,
    saveToActiveFile: false,
    changeViewBackgroundColor: true,
    clearCanvas: true,
    export: { saveFileToDisk: true },
    saveAsImage: true,
  },
  dockedSidebarBreakpoint: 1024,
} as const;

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [boardName, setBoardName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(
    null,
  );
  const [viewportState, setViewportState] =
    useState<ExcalidrawViewportState | null>(null);

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
    saveContent,
    clearPendingSave,
  } = useBoardContent(boardId ?? null);

  const latestContentRef = useRef<ExcalidrawSnapshot | null>(null);
  const initialSnapshotAppliedRef = useRef(false);

  const onRemoteDocument = useCallback(
    (data: { elements?: unknown[]; appState?: unknown }) => {
      if (!excalidrawAPI) return;
      const elements = Array.isArray(data.elements) ? data.elements : undefined;
      const normalized = normalizeAppStateForExcalidraw(data.appState);
      const appState =
        normalized ??
        (data.appState && typeof data.appState === "object"
          ? data.appState
          : undefined);
      if (elements != null || appState != null) {
        excalidrawAPI.updateScene({
          elements: (elements ??
            excalidrawAPI.getSceneElements()) as Parameters<
            ExcalidrawAPI["updateScene"]
          >[0]["elements"],
          appState: appState as Parameters<
            ExcalidrawAPI["updateScene"]
          >[0]["appState"],
        });
      }
    },
    [excalidrawAPI],
  );

  const { remoteCursors, sendCursor } = useBoardWebSocket(
    boardId ?? null,
    token,
    {
      currentUserId: user?.id ?? null,
      onRemoteDocument,
    },
  );

  const rafRef = useRef<number | null>(null);
  const sendCursorRef = useRef(sendCursor);

  useEffect(() => {
    sendCursorRef.current = sendCursor;
  }, [sendCursor]);

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

  const initialData = snapshot
    ? ({
        elements: snapshot.elements ?? undefined,
        appState:
          normalizeAppStateForExcalidraw(snapshot.appState) ??
          snapshot.appState ??
          undefined,
      } as React.ComponentProps<typeof Excalidraw>["initialData"])
    : undefined;

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown) => {
      const content: ExcalidrawSnapshot = {
        elements: [...elements],
        appState: appState as ExcalidrawSnapshot["appState"],
      };
      latestContentRef.current = content;
      scheduleSave(content);
    },
    [scheduleSave],
  );

  // Save on refresh/close so we don't lose content waiting for debounce
  useEffect(() => {
    const onBeforeUnload = () => {
      clearPendingSave();
      const content = latestContentRef.current;
      if (content?.elements?.length || content?.appState) {
        saveContent(content);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [clearPendingSave, saveContent]);

  // Apply loaded snapshot when API is ready (in case initialData didn't apply)
  useEffect(() => {
    if (!excalidrawAPI || !snapshot || initialSnapshotAppliedRef.current)
      return;
    const elements = Array.isArray(snapshot.elements)
      ? snapshot.elements
      : undefined;
    const appState =
      normalizeAppStateForExcalidraw(snapshot.appState) ??
      snapshot.appState ??
      undefined;
    if (elements != null || appState != null) {
      excalidrawAPI.updateScene({
        elements: (elements ?? excalidrawAPI.getSceneElements()) as Parameters<
          ExcalidrawAPI["updateScene"]
        >[0]["elements"],
        appState: appState as Parameters<
          ExcalidrawAPI["updateScene"]
        >[0]["appState"],
      });
      initialSnapshotAppliedRef.current = true;
    }
  }, [excalidrawAPI, snapshot]);

  useEffect(() => {
    if (boardId != null) initialSnapshotAppliedRef.current = false;
  }, [boardId]);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
    setExcalidrawAPI(api);
    const appState = api.getAppState();
    setViewportState({
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
    });
    api.onChange(() => {
      const s = api.getAppState();
      setViewportState({
        scrollX: s.scrollX,
        scrollY: s.scrollY,
        zoom: s.zoom,
        offsetLeft: s.offsetLeft,
        offsetTop: s.offsetTop,
      });
    });
    api.onScrollChange((scrollX, scrollY, zoom) => {
      const s = api.getAppState();
      setViewportState({
        scrollX,
        scrollY,
        zoom,
        offsetLeft: s.offsetLeft,
        offsetTop: s.offsetTop,
      });
    });
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!excalidrawAPI || !containerRef.current) return;
    const container = containerRef.current;
    const onPointerMove = (e: PointerEvent) => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const appState = excalidrawAPI.getAppState();
        const scene = viewportCoordsToSceneCoords(
          { clientX: e.clientX, clientY: e.clientY },
          {
            zoom: appState.zoom,
            offsetLeft: appState.offsetLeft,
            offsetTop: appState.offsetTop,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
          },
        );
        sendCursorRef.current(scene.x, scene.y);
      });
    };
    container.addEventListener("pointermove", onPointerMove);
    return () => container.removeEventListener("pointermove", onPointerMove);
  }, [excalidrawAPI]);

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
      <div className="flex-1 min-h-0 relative" ref={containerRef}>
        {contentLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[var(--text-muted)]">Loading canvas...</div>
          </div>
        ) : (
          <>
            <div className="excalidraw-board h-full w-full">
              <Excalidraw
                key={boardId}
                theme={getExcalidrawTheme(theme)}
                UIOptions={EXCALIDRAW_UI_OPTIONS}
                initialData={initialData}
                onChange={handleChange}
                excalidrawAPI={handleExcalidrawAPI}
              />
            </div>
            <RemoteCursorsOverlay
              viewportState={viewportState}
              cursors={remoteCursors}
            />
          </>
        )}
      </div>
    </div>
  );
}
