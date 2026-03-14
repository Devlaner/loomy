import { useCallback, useEffect, useRef, useState } from "react";
import { getBoardWsUrl } from "@/lib/api";

const CURSOR_EXPIRE_MS = 5000;
const CURSOR_SEND_THROTTLE_MS = 100;

export interface RemoteCursor {
  x: number;
  y: number;
  username: string;
  lastSeen: number;
}

export interface UseBoardWebSocketOptions {
  /** Current user id so we don't show our own cursor in remote list */
  currentUserId?: string | null;
  /** Called when a remote tldraw_snapshot document update is received */
  onRemoteDocument?: (document: unknown) => void;
}

export function useBoardWebSocket(
  boardId: string | null,
  token: string | null,
  options: UseBoardWebSocketOptions = {},
) {
  const { currentUserId = null, onRemoteDocument } = options;
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const lastSendRef = useRef<number>(0);
  const onRemoteDocumentRef = useRef(onRemoteDocument);
  onRemoteDocumentRef.current = onRemoteDocument;

  // Expire stale cursors
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.lastSeen < CURSOR_EXPIRE_MS) next[id] = c;
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // Connect and message handling
  useEffect(() => {
    if (!boardId || !token) {
      setConnected(false);
      setRemoteCursors({});
      return;
    }

    const url = getBoardWsUrl(boardId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          event?: string;
          data?: Record<string, unknown>;
        };
        const eventType = msg.event;
        const data = msg.data ?? {};

        if (eventType === "cursor.moved") {
          const userId = data.user_id as string | undefined;
          const x = typeof data.x === "number" ? data.x : 0;
          const y = typeof data.y === "number" ? data.y : 0;
          const username = typeof data.username === "string" ? data.username : "Anonymous";
          if (userId && userId !== currentUserId) {
            setRemoteCursors((prev) => ({
              ...prev,
              [userId]: { x, y, username, lastSeen: Date.now() },
            }));
          }
        }

        if (
          eventType === "element.updated" &&
          (data as { type?: string }).type === "tldraw_snapshot" &&
          (data as { document?: unknown }).document
        ) {
          const doc = (data as { document: unknown }).document;
          onRemoteDocumentRef.current?.(doc);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
      setRemoteCursors({});
    };
  }, [boardId, token, currentUserId]);

  const sendCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastSendRef.current < CURSOR_SEND_THROTTLE_MS) return;
    lastSendRef.current = now;
    ws.send(JSON.stringify({ event: "cursor.moved", data: { x, y } }));
  }, []);

  return { connected, remoteCursors, sendCursor };
}
