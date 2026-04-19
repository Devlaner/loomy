import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBoardWsUrl } from "@/lib/api";

const CURSOR_EXPIRE_MS = 15_000;
const CURSOR_SEND_THROTTLE_MS = 50;

export interface RemoteCursor {
  x: number;
  y: number;
  username: string;
  lastSeen: number;
}

export interface UseBoardWebSocketOptions {
  currentUserId?: string | null;
  onRemoteDocument?: (data: {
    elements?: unknown[];
    appState?: unknown;
  }) => void;
  onRemoteBinary?: (data: Uint8Array) => void;
  onRemoteEvent?: (event: string, data: Record<string, unknown>) => void;
}

// Stable per-mount identifier tagged onto every outgoing cursor.moved
// frame. Lets each client recognize (and drop) its own echoes without
// depending on async-loaded auth state. Regenerated per WebSocket
// connect so reconnects don't confuse the filter.
function makeClientId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `c_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function useBoardWebSocket(
  boardId: string | null,
  token: string | null,
  options: UseBoardWebSocketOptions = {},
) {
  const { onRemoteDocument, onRemoteBinary, onRemoteEvent } = options;
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, RemoteCursor>
  >({});
  const wsRef = useRef<WebSocket | null>(null);
  const lastSendRef = useRef<number>(0);
  const clientId = useMemo(() => makeClientId(), []);
  const onRemoteDocumentRef = useRef(onRemoteDocument);
  const onRemoteBinaryRef = useRef(onRemoteBinary);
  const onRemoteEventRef = useRef(onRemoteEvent);

  useEffect(() => {
    onRemoteDocumentRef.current = onRemoteDocument;
  }, [onRemoteDocument]);

  useEffect(() => {
    onRemoteBinaryRef.current = onRemoteBinary;
  }, [onRemoteBinary]);

  useEffect(() => {
    onRemoteEventRef.current = onRemoteEvent;
  }, [onRemoteEvent]);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.lastSeen < CURSOR_EXPIRE_MS) next[id] = c;
        }
        return Object.keys(next).length === Object.keys(prev).length
          ? prev
          : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    if (!boardId || !token) return;

    const url = getBoardWsUrl(boardId);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "auth", token }));
      } catch {
        // already closed
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onRemoteBinaryRef.current?.(new Uint8Array(event.data));
        return;
      }
      if (typeof event.data !== "string") return;

      let msg: { event?: string; data?: Record<string, unknown> };
      try {
        msg = JSON.parse(event.data) as typeof msg;
      } catch {
        return;
      }
      const eventType = msg.event;
      const data = msg.data ?? {};

      if (eventType === "auth.ok") {
        setConnected(true);
        return;
      }

      if (eventType === "cursor.moved") {
        const senderClientId =
          typeof data.client_id === "string" ? data.client_id : null;
        // Self-echo only: drop our own frames. Same user in another
        // tab has a different client_id and SHOULD still render.
        if (senderClientId && senderClientId === clientId) return;
        const userId = data.user_id as string | undefined;
        const x = typeof data.x === "number" ? data.x : 0;
        const y = typeof data.y === "number" ? data.y : 0;
        const username =
          typeof data.username === "string" ? data.username : "Anonymous";
        // Key by client_id when present so two tabs of the same
        // account don't clobber each other.
        const key = senderClientId || userId;
        if (key) {
          setRemoteCursors((prev) => ({
            ...prev,
            [key]: { x, y, username, lastSeen: Date.now() },
          }));
        }
      }

      if (
        eventType === "element.updated" &&
        (data as { type?: string }).type === "excalidraw_snapshot" &&
        ((data as { elements?: unknown }).elements != null ||
          (data as { appState?: unknown }).appState != null)
      ) {
        onRemoteDocumentRef.current?.(
          data as { elements?: unknown[]; appState?: unknown },
        );
      }

      if (eventType && eventType !== "auth.ok") {
        onRemoteEventRef.current?.(eventType, data);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
      setRemoteCursors({});
    };
  }, [boardId, token, clientId]);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - lastSendRef.current < CURSOR_SEND_THROTTLE_MS) return;
      lastSendRef.current = now;
      ws.send(
        JSON.stringify({
          event: "cursor.moved",
          data: { x, y, client_id: clientId },
        }),
      );
    },
    [clientId],
  );

  const sendBinary = useCallback((data: Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(data);
  }, []);

  return { connected, remoteCursors, sendCursor, sendBinary };
}
