import { useCallback, useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { UndoManager } from "yjs";
import {
  LOCAL_ORIGIN,
  PERSISTENCE_LOAD_ORIGIN,
  REMOTE_ORIGIN,
  applyElementsToYMap,
  readElementsFromYMap,
  type ElementJson,
} from "@/lib/collab/yjs-bridge";
import { decodeYjsUpdate, encodeYjsDoc } from "@/lib/collab/yjs-persistence";
import {
  useBoardWebSocket,
  type UseBoardWebSocketOptions,
} from "./useBoardWebSocket";

export interface UseBoardCollabOptions extends Omit<
  UseBoardWebSocketOptions,
  "onRemoteBinary"
> {
  onRemoteElements?: (elements: ElementJson[]) => void;
}

export function useBoardCollab(
  boardId: string | null,
  token: string | null,
  options: UseBoardCollabOptions = {},
) {
  const { onRemoteElements, ...wsOptions } = options;
  const onRemoteElementsRef = useRef(onRemoteElements);
  useEffect(() => {
    onRemoteElementsRef.current = onRemoteElements;
  }, [onRemoteElements]);

  // boardId is the dependency even though the factory doesn't read it:
  // changing boards must produce a fresh Y.Doc.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => new Y.Doc(), [boardId]);
  useEffect(() => {
    return () => {
      doc.destroy();
    };
  }, [doc]);

  const ymap = useMemo(() => doc.getMap<ElementJson>("elements"), [doc]);

  // Per-user undo scope: only the local client's edits are in the stack.
  // Remote edits don't end up on our undo history — you can only undo
  // what you yourself did.
  const undoManager = useMemo(
    () => new UndoManager(ymap, { trackedOrigins: new Set([LOCAL_ORIGIN]) }),
    [ymap],
  );
  useEffect(() => {
    return () => {
      undoManager.destroy();
    };
  }, [undoManager]);

  const undo = useCallback(() => {
    if (undoManager.canUndo()) undoManager.undo();
  }, [undoManager]);

  const redo = useCallback(() => {
    if (undoManager.canRedo()) undoManager.redo();
  }, [undoManager]);

  const onRemoteBinary = useCallback(
    (data: Uint8Array) => {
      Y.applyUpdate(doc, data, REMOTE_ORIGIN);
    },
    [doc],
  );

  const ws = useBoardWebSocket(boardId, token, {
    ...wsOptions,
    onRemoteBinary,
  });
  const { sendBinary, connected } = ws;

  useEffect(() => {
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN || origin === PERSISTENCE_LOAD_ORIGIN) {
        return;
      }
      sendBinary(update);
    };
    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc, sendBinary]);

  useEffect(() => {
    if (!connected) return;
    sendBinary(Y.encodeStateAsUpdate(doc));
  }, [connected, doc, sendBinary]);

  useEffect(() => {
    const observer = (event: Y.YMapEvent<ElementJson>) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return;
      const elements = readElementsFromYMap(ymap);
      onRemoteElementsRef.current?.(elements);
    };
    ymap.observe(observer);
    return () => {
      ymap.unobserve(observer);
    };
  }, [ymap]);

  const syncLocalElements = useCallback(
    (elements: readonly ElementJson[]) => {
      applyElementsToYMap(doc, ymap, elements);
    },
    [doc, ymap],
  );

  const seedFromSnapshot = useCallback(
    (elements: readonly ElementJson[] | null | undefined) => {
      if (!elements || elements.length === 0) return;
      applyElementsToYMap(doc, ymap, elements);
    },
    [doc, ymap],
  );

  const encodeYjsState = useCallback((): string => {
    return encodeYjsDoc(doc);
  }, [doc]);

  const applyYjsState = useCallback(
    (b64: string): void => {
      if (!b64) return;
      try {
        Y.applyUpdate(doc, decodeYjsUpdate(b64), PERSISTENCE_LOAD_ORIGIN);
      } catch {
        // Fall back to the JSON snapshot path in the caller.
      }
    },
    [doc],
  );

  return {
    ...ws,
    syncLocalElements,
    seedFromSnapshot,
    encodeYjsState,
    applyYjsState,
    undo,
    redo,
  };
}
