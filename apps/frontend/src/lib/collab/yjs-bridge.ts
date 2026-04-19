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

function elementsEqual(a: ElementJson, b: ElementJson): boolean {
  if (
    typeof a.versionNonce === "number" &&
    typeof b.versionNonce === "number"
  ) {
    return a.versionNonce === b.versionNonce;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
