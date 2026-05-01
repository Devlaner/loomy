import { useCallback, useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { UndoManager } from "yjs";
import {
  LOCAL_ORIGIN,
  PERSISTENCE_LOAD_ORIGIN,
  REMOTE_ORIGIN,
  applyElementsToYMap,
  applyElementsToYMapInner,
  applyFilesToYMap,
  applyFilesToYMapInner,
  readElementsFromYMap,
  readFilesFromYMap,
  type ElementJson,
  type FileJson,
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
  onRemoteFiles?: (files: FileJson[]) => void;
}

export function useBoardCollab(
  boardId: string | null,
  token: string | null,
  options: UseBoardCollabOptions = {},
) {
  const { onRemoteElements, onRemoteFiles, ...wsOptions } = options;
  const onRemoteElementsRef = useRef(onRemoteElements);
  const onRemoteFilesRef = useRef(onRemoteFiles);
  useEffect(() => {
    onRemoteElementsRef.current = onRemoteElements;
  }, [onRemoteElements]);
  useEffect(() => {
    onRemoteFilesRef.current = onRemoteFiles;
  }, [onRemoteFiles]);

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
  const yfiles = useMemo(() => doc.getMap<FileJson>("files"), [doc]);

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

  useEffect(() => {
    const observer = (event: Y.YMapEvent<FileJson>) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return;
      const added: FileJson[] = [];
      for (const id of event.keysChanged) {
        const f = yfiles.get(id);
        if (f) added.push(f);
      }
      if (added.length > 0) onRemoteFilesRef.current?.(added);
    };
    yfiles.observe(observer);
    return () => {
      yfiles.unobserve(observer);
    };
  }, [yfiles]);

  const syncLocalElements = useCallback(
    (elements: readonly ElementJson[]) => {
      applyElementsToYMap(doc, ymap, elements);
    },
    [doc, ymap],
  );

  const syncLocalFiles = useCallback(
    (files: Readonly<Record<string, FileJson>> | null | undefined) => {
      if (!files) return;
      applyFilesToYMap(doc, yfiles, files);
    },
    [doc, yfiles],
  );

  // Combined writer used by the canvas onChange handler. One outer
  // transact means files + elements travel as a single Yjs update,
  // so a peer never sees an image element whose fileId hasn't been
  // populated in the files map yet (which renders the image as a
  // pending placeholder Excalidraw won't let you interact with).
  // Calls the *Inner helpers (no nested transacts) so this is the
  // single place that defines the transaction boundary and origin.
  const syncLocalChanges = useCallback(
    (
      elements: readonly ElementJson[],
      files: Readonly<Record<string, FileJson>> | null | undefined,
    ) => {
      doc.transact(() => {
        if (files) applyFilesToYMapInner(yfiles, files);
        applyElementsToYMapInner(ymap, elements);
      }, LOCAL_ORIGIN);
    },
    [doc, ymap, yfiles],
  );

  const readAllFiles = useCallback(
    (): FileJson[] => readFilesFromYMap(yfiles),
    [yfiles],
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
    syncLocalFiles,
    syncLocalChanges,
    readAllFiles,
    seedFromSnapshot,
    encodeYjsState,
    applyYjsState,
    undo,
    redo,
  };
}
