import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBoardWsUrl } from "@/lib/api";

const CURSOR_EXPIRE_MS = 15_000;
const CURSOR_SEND_THROTTLE_MS = 50;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 10_000;

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
  // True while a dropped connection is being retried in the background —
  // lets the UI show "reconnecting" instead of silently doing nothing
  // until the user notices collaboration stopped working.
  const [reconnecting, setReconnecting] = useState(false);
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

    // Guards against reconnecting after this effect has been cleaned up
    // (boardId/token changed, or the component unmounted) — closing the
    // socket in cleanup would otherwise trigger onclose -> reconnect.
    let torndown = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
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

      ws.onclose = () => {
        setConnected(false);
        if (torndown) return;
        setReconnecting(true);
        const delay = Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
          RECONNECT_MAX_DELAY_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          if (!torndown) connect();
        }, delay);
      };
      // A real close always follows an error per the WebSocket spec, so
      // onclose alone owns reconnect scheduling — this only updates state.
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
          setReconnecting(false);
          reconnectAttempt = 0;
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

        if (eventType === "peer.left") {
          const leftClientId =
            typeof data.client_id === "string" ? data.client_id : null;
          const leftUserId =
            typeof data.user_id === "string" ? data.user_id : null;
          const key = leftClientId || leftUserId;
          if (key) {
            setRemoteCursors((prev) => {
              if (!(key in prev)) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
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
    };

    connect();

    return () => {
      torndown = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setReconnecting(false);
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

  return { connected, reconnecting, remoteCursors, sendCursor, sendBinary };
}
