import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "@/styles/excalidraw-board.css";

import { PageTitle } from "@/components/PageTitle";
import { useTheme } from "@/context/ThemeContext";
import {
  readElementsFromYMap,
  readFilesFromYMap,
  type ElementJson,
  type FileJson,
} from "@/lib/collab/yjs-bridge";
import { decodeYjsUpdate } from "@/lib/collab/yjs-persistence";

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
  files?: Record<string, unknown> | null;
  yjs_update?: string | null;
};

// New saves omit `files` because the same blobs are already inside
// `yjs_update`. Decode the Y.Doc here so the read-only viewer renders
// images regardless of whether the snapshot was written before or after
// that change.
function unpackSnapshot(snapshot: Snapshot): {
  elements?: readonly unknown[];
  files?: Record<string, unknown>;
  appState?: Record<string, unknown>;
} {
  if (snapshot.yjs_update) {
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, decodeYjsUpdate(snapshot.yjs_update));
      const ymap = doc.getMap<ElementJson>("elements");
      const yfiles = doc.getMap<FileJson>("files");
      const elements = readElementsFromYMap(ymap);
      const fileEntries = readFilesFromYMap(yfiles);
      doc.destroy();
      const files: Record<string, unknown> = {};
      for (const f of fileEntries) files[f.id] = f;
      return {
        elements: elements.length > 0 ? elements : undefined,
        files: fileEntries.length > 0 ? files : undefined,
        appState: snapshot.appState ?? undefined,
      };
    } catch {
      // Corrupt yjs_update — fall through to legacy fields.
    }
  }
  return {
    elements: snapshot.elements ?? undefined,
    files: snapshot.files ?? undefined,
    appState: snapshot.appState ?? undefined,
  };
}

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

  const unpacked = unpackSnapshot(snapshot);
  const initialData = {
    elements: unpacked.elements,
    appState:
      normalizeAppStateForExcalidraw(unpacked.appState) ??
      unpacked.appState ??
      undefined,
    files: unpacked.files,
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
