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

export function applyElementsToYMap(
  doc: Y.Doc,
  ymap: Y.Map<ElementJson>,
  elements: readonly ElementJson[],
): void {
  doc.transact(() => {
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

export function applyFilesToYMap(
  doc: Y.Doc,
  ymap: Y.Map<FileJson>,
  files: Readonly<Record<string, FileJson>>,
): void {
  // Files are insert-only by stable id. Excalidraw retains BinaryFileData
  // blobs even after the referencing image element is deleted, and the
  // local `files` map can transiently lack an entry that was uploaded by
  // another peer — never delete from the shared map on absence, only add.
  const ids = Object.keys(files);
  if (ids.length === 0) return;
  doc.transact(() => {
    for (const id of ids) {
      const f = files[id];
      if (!f || typeof f.id !== "string") continue;
      if (!ymap.has(id)) ymap.set(id, { ...f });
    }
  }, LOCAL_ORIGIN);
}

export function readFilesFromYMap(ymap: Y.Map<FileJson>): FileJson[] {
  return Array.from(ymap.values());
}

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
  // Slow path — Excalidraw sometimes bumps an element's version /
  // versionNonce without changing visible content (e.g. when applying
  // an inbound updateScene). If we treated those as different, we'd
  // echo a "no-op" change back to the peer, and that echo lands on
  // their canvas mid-drag and snaps them back to the pre-drag spot.
  return canonicalize(a) === canonicalize(b);
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

function canonicalize(el: ElementJson): string {
  const keys = Object.keys(el)
    .filter((k) => !DRIFT_FIELDS.has(k))
    .sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = (el as Record<string, unknown>)[k];
  return JSON.stringify(out);
}
