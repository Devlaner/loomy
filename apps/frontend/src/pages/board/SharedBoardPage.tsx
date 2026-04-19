import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "@/styles/excalidraw-board.css";

import { PageTitle } from "@/components/PageTitle";
import { useTheme } from "@/context/ThemeContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getExcalidrawTheme(
  theme: "light" | "dark" | "soft",
): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

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

const VIEWER_UI_OPTIONS = {
  canvasActions: {
    toggleTheme: false,
    loadScene: false,
    saveToActiveFile: false,
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: { saveFileToDisk: true },
    saveAsImage: true,
  },
  dockedSidebarBreakpoint: 1024,
} as const;

type Snapshot = {
  elements?: readonly unknown[] | null;
  appState?: Record<string, unknown> | null;
};

export function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const { theme } = useTheme();
  const [boardName, setBoardName] = useState<string>("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/public/boards/${token}/snapshot`,
        );
        if (!res.ok) {
          setError(
            res.status === 404
              ? "This share link is invalid or has expired."
              : "Failed to load shared board.",
          );
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setBoardName(body.board?.name ?? "Shared board");
        setSnapshot(body.snapshot ?? {});
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-[var(--text-muted)]">
          {error ?? "Shared board not available."}
        </div>
      </div>
    );
  }

  const initialData = {
    elements: snapshot.elements ?? undefined,
    appState:
      normalizeAppStateForExcalidraw(snapshot.appState) ??
      snapshot.appState ??
      undefined,
  } as React.ComponentProps<typeof Excalidraw>["initialData"];

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg-primary)]">
      <PageTitle title={boardName || "Shared board"} />
      <header className="h-12 shrink-0 flex items-center gap-4 px-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {boardName || "Shared board"}
        </span>
        <span className="ml-2 text-xs text-[var(--text-muted)]">read-only</span>
      </header>
      <div className="flex-1 min-h-0 relative">
        <div className="excalidraw-board h-full w-full">
          <Excalidraw
            theme={getExcalidrawTheme(theme)}
            UIOptions={VIEWER_UI_OPTIONS}
            initialData={initialData}
            viewModeEnabled
          />
        </div>
      </div>
    </div>
  );
}
