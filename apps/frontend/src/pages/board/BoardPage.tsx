import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "@/styles/excalidraw-board.css";

import { CommentsPane } from "@/components/board/CommentsPane";
import { PageTitle } from "@/components/PageTitle";
import { ShareDialog } from "@/components/board/ShareDialog";
import { Button, Dropdown } from "@/components/ui";
import { useBoardCollab } from "@/hooks/useBoardCollab";
import { useBoardContent } from "@/hooks/useBoardContent";
import type { ExcalidrawSnapshot } from "@/hooks/useBoardContent";
import { useBoardInit } from "@/hooks/useBoardInit";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch } from "@/lib/api";
import type { ElementJson } from "@/lib/collab/yjs-bridge";
import { useAuthStore } from "@/stores/authStore";

type ExcalidrawAPI = Parameters<
  NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

function getExcalidrawTheme(
  theme: "light" | "dark" | "soft",
): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

// Excalidraw requires `collaborators` to be a Map; JSON can't represent one.
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
  const { theme } = useTheme();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Event bus so child panes can subscribe to server-pushed text
  // events (e.g. comment.created, comment.deleted) without opening
  // their own WebSocket. useBoardCollab forwards every event here.
  type BoardEventHandler = (
    event: string,
    data: Record<string, unknown>,
  ) => void;
  const boardEventSubsRef = useRef<Set<BoardEventHandler>>(new Set());
  const subscribeToBoardEvent = useCallback((h: BoardEventHandler) => {
    boardEventSubsRef.current.add(h);
    return () => {
      boardEventSubsRef.current.delete(h);
    };
  }, []);
  const fanoutBoardEvent = useCallback<BoardEventHandler>((event, data) => {
    for (const h of boardEventSubsRef.current) h(event, data);
  }, []);

  const { authChecked, boardName } = useBoardInit(boardId ?? null, token);

  const download = useCallback(
    async (kind: "png" | "svg") => {
      if (!excalidrawAPI) return;
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      try {
        let url: string;
        let filename: string;
        if (kind === "png") {
          const blob = await exportToBlob({
            elements,
            appState: {
              ...appState,
              exportWithDarkMode: false,
              exportBackground: true,
            },
            files,
            mimeType: "image/png",
          });
          url = URL.createObjectURL(blob);
          filename = `${boardName || "board"}.png`;
        } else {
          const svg = await exportToSvg({
            elements,
            appState: {
              ...appState,
              exportWithDarkMode: false,
              exportBackground: true,
            },
            files,
          });
          const blob = new Blob([svg.outerHTML], {
            type: "image/svg+xml",
          });
          url = URL.createObjectURL(blob);
          filename = `${boardName || "board"}.svg`;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch {
        // Silent fail — Excalidraw's built-in export remains a fallback.
      }
    },
    [excalidrawAPI, boardName],
  );

  useEffect(() => {
    if (!token || user) return;
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data);
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

  const onRemoteElements = useCallback(
    (elements: ElementJson[]) => {
      if (!excalidrawAPI) return;
      excalidrawAPI.updateScene({
        elements: elements as unknown as Parameters<
          ExcalidrawAPI["updateScene"]
        >[0]["elements"],
      });
    },
    [excalidrawAPI],
  );

  const {
    remoteCursors,
    sendCursor,
    syncLocalElements,
    seedFromSnapshot,
    encodeYjsState,
    applyYjsState,
    undo,
    redo,
  } = useBoardCollab(boardId ?? null, token, {
    currentUserId: user?.id ?? null,
    onRemoteDocument,
    onRemoteElements,
    onRemoteEvent: fanoutBoardEvent,
  });

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z drive the collab-aware undo stack
  // (only undoes the local user's own ops, not remote ones).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Excalidraw's native pointer hook. Fires reliably (pointermove on
  // the wrapper div is stopPropagation'd by Excalidraw itself) and
  // hands us scene coordinates directly, so no viewport math here.
  const sendCursorRef = useRef(sendCursor);
  useEffect(() => {
    sendCursorRef.current = sendCursor;
  }, [sendCursor]);
  const onPointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number } }) => {
      const { x, y } = payload.pointer;
      if (typeof x === "number" && typeof y === "number") {
        sendCursorRef.current(x, y);
      }
    },
    [],
  );

  // Render remote cursors via Excalidraw's native `collaborators` Map.
  // Excalidraw draws the cursor, label, and handles all positioning /
  // zoom / pan transforms inside the canvas itself.
  const CURSOR_COLORS = [
    "#e11d48",
    "#d97706",
    "#16a34a",
    "#0891b2",
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#0d9488",
  ];
  useEffect(() => {
    if (!excalidrawAPI) return;
    const collaborators = new Map<string, Record<string, unknown>>();
    for (const [key, c] of Object.entries(remoteCursors)) {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) | 0;
      }
      const color = CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
      collaborators.set(key, {
        pointer: { x: c.x, y: c.y, tool: "pointer" },
        button: "up",
        username: c.username,
        color: { background: color, stroke: color },
      });
    }
    excalidrawAPI.updateScene({
      collaborators: collaborators as Parameters<
        ExcalidrawAPI["updateScene"]
      >[0]["collaborators"],
    });
    // CURSOR_COLORS is a module-const-like array; exhaustive-deps would
    // force a useMemo indirection that adds no value here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excalidrawAPI, remoteCursors]);

  const initialData = snapshot
    ? ({
        elements: snapshot.elements ?? undefined,
        appState:
          normalizeAppStateForExcalidraw(snapshot.appState) ??
          snapshot.appState ??
          undefined,
      } as React.ComponentProps<typeof Excalidraw>["initialData"])
    : undefined;

  // Keep the latest elements+appState in refs so the deferred getter
  // below can read them at save time without re-encoding the Y.Doc on
  // every pointer move (that ran 60x/sec during drag and was the main
  // reason the canvas felt sluggish).
  const latestElementsRef = useRef<readonly unknown[]>([]);
  const latestAppStateRef = useRef<unknown>(undefined);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown) => {
      syncLocalElements(elements as readonly ElementJson[]);
      latestElementsRef.current = elements;
      latestAppStateRef.current = appState;
      scheduleSave(() => {
        const content: ExcalidrawSnapshot = {
          elements: [...latestElementsRef.current],
          appState: latestAppStateRef.current as ExcalidrawSnapshot["appState"],
          yjs_update: encodeYjsState(),
        };
        latestContentRef.current = content;
        return content;
      });
    },
    [scheduleSave, syncLocalElements, encodeYjsState],
  );

  useEffect(() => {
    const onBeforeUnload = () => {
      clearPendingSave();
      const content = latestContentRef.current;
      if (
        content?.elements?.length ||
        content?.appState ||
        content?.yjs_update
      ) {
        saveContent(content);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [clearPendingSave, saveContent]);

  useEffect(() => {
    if (!excalidrawAPI || !snapshot || initialSnapshotAppliedRef.current)
      return;

    const appState =
      normalizeAppStateForExcalidraw(snapshot.appState) ??
      snapshot.appState ??
      undefined;

    if (snapshot.yjs_update) {
      applyYjsState(snapshot.yjs_update);
      if (appState != null) {
        excalidrawAPI.updateScene({
          elements: excalidrawAPI.getSceneElements() as Parameters<
            ExcalidrawAPI["updateScene"]
          >[0]["elements"],
          appState: appState as Parameters<
            ExcalidrawAPI["updateScene"]
          >[0]["appState"],
        });
      }
      initialSnapshotAppliedRef.current = true;
      return;
    }

    const elements = Array.isArray(snapshot.elements)
      ? snapshot.elements
      : undefined;
    if (elements != null || appState != null) {
      excalidrawAPI.updateScene({
        elements: (elements ?? excalidrawAPI.getSceneElements()) as Parameters<
          ExcalidrawAPI["updateScene"]
        >[0]["elements"],
        appState: appState as Parameters<
          ExcalidrawAPI["updateScene"]
        >[0]["appState"],
      });
      if (elements) {
        seedFromSnapshot(elements as readonly ElementJson[]);
      }
      initialSnapshotAppliedRef.current = true;
    }
  }, [excalidrawAPI, snapshot, seedFromSnapshot, applyYjsState]);

  useEffect(() => {
    if (boardId != null) initialSnapshotAppliedRef.current = false;
  }, [boardId]);

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
        <div className="ml-auto flex items-center gap-2">
          <Dropdown
            trigger={
              <Button type="button" variant="outline" size="sm">
                Export
              </Button>
            }
          >
            <button
              type="button"
              onClick={() => download("png")}
              className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              PNG image
            </button>
            <button
              type="button"
              onClick={() => download("svg")}
              className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              SVG vector
            </button>
          </Dropdown>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCommentsOpen((v) => !v)}
          >
            Comments
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
          >
            Share
          </Button>
        </div>
      </header>
      {shareOpen && (
        <ShareDialog boardId={boardId} onClose={() => setShareOpen(false)} />
      )}
      <div className="flex-1 min-h-0 flex">
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
                  onPointerUpdate={onPointerUpdate}
                  excalidrawAPI={setExcalidrawAPI}
                />
              </div>
            </>
          )}
        </div>
        {commentsOpen && (
          <CommentsPane
            boardId={boardId}
            currentUserId={user?.id ?? null}
            onClose={() => setCommentsOpen(false)}
            subscribeToBoardEvent={subscribeToBoardEvent}
          />
        )}
      </div>
    </div>
  );
}
