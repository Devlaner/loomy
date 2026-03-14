import { useEffect, useState } from "react";
import type { RemoteCursor } from "@/hooks/useBoardWebSocket";

/** Editor-like: pageToViewport for positioning; store.listen to react to camera changes. */
interface EditorLike {
  pageToViewport: (point: { x: number; y: number }) => { x: number; y: number };
  store: { listen: (listener: (...args: unknown[]) => void) => () => void };
}

interface RemoteCursorsOverlayProps {
  editor: EditorLike | null;
  cursors: Record<string, RemoteCursor>;
}

export function RemoteCursorsOverlay({ editor, cursors }: RemoteCursorsOverlayProps) {
  const [, setTick] = useState(0);

  // Re-render when camera/zoom changes so cursor positions update
  useEffect(() => {
    if (!editor) return;
    const unsub = editor.store.listen(() => setTick((t) => t + 1));
    return unsub;
  }, [editor]);

  if (!editor) return null;

  const entries = Object.entries(cursors);
  if (entries.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {entries.map(([userId, cursor]) => {
        const vp = editor.pageToViewport({ x: cursor.x, y: cursor.y });
        return (
          <div
            key={userId}
            className="absolute flex items-center gap-1.5 transition-transform duration-75 will-change-transform"
            style={{
              left: vp.x,
              top: vp.y,
              transform: "translate(8px, 8px)",
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-[var(--bg-primary)] shadow-sm"
              style={{ backgroundColor: "var(--accent)" }}
            />
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded max-w-[120px] truncate"
              style={{
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {cursor.username}
            </span>
          </div>
        );
      })}
    </div>
  );
}
