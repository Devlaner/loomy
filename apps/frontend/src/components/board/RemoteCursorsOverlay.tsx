import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawViewportState } from "@/pages/board/BoardPage";
import type { RemoteCursor } from "@/hooks/useBoardWebSocket";

interface RemoteCursorsOverlayProps {
  viewportState: ExcalidrawViewportState | null;
  cursors: Record<string, RemoteCursor>;
}

export function RemoteCursorsOverlay({
  viewportState,
  cursors,
}: RemoteCursorsOverlayProps) {
  const entries = Object.entries(cursors);
  if (!viewportState || entries.length === 0) return null;

  const { scrollX, scrollY, zoom, offsetLeft, offsetTop } = viewportState;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden
    >
      {entries.map(([userId, cursor]) => {
        const vp = sceneCoordsToViewportCoords(
          { sceneX: cursor.x, sceneY: cursor.y },
          {
            scrollX,
            scrollY,
            zoom,
            offsetLeft,
            offsetTop,
          } as Parameters<typeof sceneCoordsToViewportCoords>[1],
        );
        return (
          <div
            key={userId}
            className="absolute flex items-center gap-1.5 transition-transform duration-75 will-change-transform"
            style={{
              left: vp.x + offsetLeft,
              top: vp.y + offsetTop,
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
