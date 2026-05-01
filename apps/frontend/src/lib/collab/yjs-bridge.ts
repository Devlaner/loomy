import * as Y from "yjs";

export type ElementJson = Record<string, unknown> & {
  id: string;
  versionNonce?: number;
};

// Module-scoped symbols used as Yjs transaction origins. Origin is a
// local JS reference and is not encoded into update bytes, so these
// only need to be === comparable.
export const LOCAL_ORIGIN: unique symbol = Symbol("loomy-local");
export const REMOTE_ORIGIN: unique symbol = Symbol("loomy-remote");
export const PERSISTENCE_LOAD_ORIGIN: unique symbol = Symbol(
  "loomy-persistence-load",
);

// Inner: assumes the caller is already inside a Y transaction. Lets the
// combined writer (`syncLocalChanges`) batch element + file writes into
// one transaction without nesting.
export function applyElementsToYMapInner(
  ymap: Y.Map<ElementJson>,
  elements: readonly ElementJson[],
): void {
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el || typeof el.id !== "string") continue;
    seen.add(el.id);
    const existing = ymap.get(el.id);
    if (!existing || !elementsEqual(existing, el)) {
      // Clone before storing. Y.Map holds the value by reference,
      // and Excalidraw mutates its own elements in place during drag.
      // If we stored `el` directly, `existing === el` would make the
      // diff see no change on the next onChange, so updates would
      // stop propagating after the first pointer-down.
      ymap.set(el.id, { ...el });
    }
  }
  for (const id of Array.from(ymap.keys())) {
    if (!seen.has(id)) ymap.delete(id);
  }
}

export function applyElementsToYMap(
  doc: Y.Doc,
  ymap: Y.Map<ElementJson>,
  elements: readonly ElementJson[],
): void {
  doc.transact(() => {
    applyElementsToYMapInner(ymap, elements);
  }, LOCAL_ORIGIN);
}

export function readElementsFromYMap(ymap: Y.Map<ElementJson>): ElementJson[] {
  const values = Array.from(ymap.values());
  values.sort((a, b) => {
    const ai = typeof a.index === "string" ? a.index : "";
    const bi = typeof b.index === "string" ? b.index : "";
    if (ai && bi) return ai < bi ? -1 : ai > bi ? 1 : 0;
    return 0;
  });
  return values;
}

export type FileJson = Record<string, unknown> & { id: string };

// Inner: see applyElementsToYMapInner for the rationale on the split.
// Files are insert-only by stable id. Excalidraw retains BinaryFileData
// blobs even after the referencing image element is deleted, and the
// local `files` map can transiently lack an entry that was uploaded by
// another peer — never delete from the shared map on absence, only add.
export function applyFilesToYMapInner(
  ymap: Y.Map<FileJson>,
  files: Readonly<Record<string, FileJson>>,
): void {
  for (const id of Object.keys(files)) {
    const f = files[id];
    if (!f || typeof f.id !== "string") continue;
    if (!ymap.has(id)) ymap.set(id, { ...f });
  }
}

export function applyFilesToYMap(
  doc: Y.Doc,
  ymap: Y.Map<FileJson>,
  files: Readonly<Record<string, FileJson>>,
): void {
  if (Object.keys(files).length === 0) return;
  doc.transact(() => {
    applyFilesToYMapInner(ymap, files);
  }, LOCAL_ORIGIN);
}

export function readFilesFromYMap(ymap: Y.Map<FileJson>): FileJson[] {
  return Array.from(ymap.values());
}

// Fields Excalidraw bumps on every "touch" without any user-visible
// change. `updated` is the epoch ms of the last modification (re-stamped
// when updateScene applies an inbound element); `version` /
// `versionNonce` are Excalidraw's own collab-reconciliation cursors;
// `seed` is for roughjs shape stability and shouldn't drift, but is
// excluded defensively in case a clone path regenerates it.
const DRIFT_FIELDS: ReadonlySet<string> = new Set([
  "version",
  "versionNonce",
  "updated",
  "seed",
]);

function elementsEqual(a: ElementJson, b: ElementJson): boolean {
  // Fast path — matching versionNonce always implies identical content,
  // so we can skip the structural compare on the hot drag path.
  if (
    typeof a.versionNonce === "number" &&
    typeof b.versionNonce === "number" &&
    a.versionNonce === b.versionNonce
  ) {
    return true;
  }
  // Slow path — direct walk that ignores drift fields. Short-circuits
  // on the first real mismatch and never allocates (no JSON.stringify,
  // no Object.keys, no sort). On the steady drag echo, the walk visits
  // each non-drift field once and returns true the moment it confirms
  // they all match.
  return contentEqual(a, b);
}

function contentEqual(a: ElementJson, b: ElementJson): boolean {
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  let aCount = 0;
  for (const k in ao) {
    if (DRIFT_FIELDS.has(k)) continue;
    aCount++;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  let bCount = 0;
  for (const k of Object.keys(bo)) {
    if (!DRIFT_FIELDS.has(k)) bCount++;
  }
  return aCount === bCount;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  let countA = 0;
  for (const k in objA) {
    countA++;
    if (!deepEqual(objA[k], objB[k])) return false;
  }
  return countA === Object.keys(objB).length;
}
