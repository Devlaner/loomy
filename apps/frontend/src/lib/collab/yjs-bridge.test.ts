import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyElementsToYMap,
  applyFilesToYMap,
  readElementsFromYMap,
  readFilesFromYMap,
  type ElementJson,
  type FileJson,
} from "./yjs-bridge";

function makeDoc() {
  const doc = new Y.Doc();
  const ymap = doc.getMap<ElementJson>("elements");
  return { doc, ymap };
}

describe("applyElementsToYMap", () => {
  it("adds elements not yet in the map", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "a", versionNonce: 1 },
      { id: "b", versionNonce: 1 },
    ]);
    expect(ymap.size).toBe(2);
    expect(ymap.get("a")).toEqual({ id: "a", versionNonce: 1 });
  });

  it("replaces elements whose versionNonce changed", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [{ id: "a", versionNonce: 1, x: 10 }]);
    applyElementsToYMap(doc, ymap, [{ id: "a", versionNonce: 2, x: 99 }]);
    expect(ymap.get("a")).toEqual({ id: "a", versionNonce: 2, x: 99 });
  });

  it("skips writes when versionNonce is unchanged", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [{ id: "a", versionNonce: 1 }]);

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [{ id: "a", versionNonce: 1 }]);
    expect(updates).toBe(0);
  });

  it("deletes elements that disappear from the input", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "a", versionNonce: 1 },
      { id: "b", versionNonce: 1 },
    ]);
    applyElementsToYMap(doc, ymap, [{ id: "a", versionNonce: 1 }]);
    expect(ymap.size).toBe(1);
    expect(ymap.has("b")).toBe(false);
  });

  it("ignores entries missing an id", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "a", versionNonce: 1 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { versionNonce: 1 } as any,
    ]);
    expect(ymap.size).toBe(1);
  });
});

describe("readElementsFromYMap", () => {
  it("returns all elements", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "a", versionNonce: 1 },
      { id: "b", versionNonce: 1 },
    ]);
    const ids = readElementsFromYMap(ymap)
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("sorts by fractional index when present", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "c", versionNonce: 1, index: "a3" },
      { id: "a", versionNonce: 1, index: "a1" },
      { id: "b", versionNonce: 1, index: "a2" },
    ]);
    const ids = readElementsFromYMap(ymap).map((e) => e.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("in-place element mutation (regression: 'only a dot' bug)", () => {
  it("still detects versionNonce changes when the caller mutates the same object reference", () => {
    const { doc, ymap } = makeDoc();
    const el: ElementJson = { id: "x", versionNonce: 1, width: 1, height: 1 };
    applyElementsToYMap(doc, ymap, [el]);

    // Excalidraw mutates the same element reference during drag.
    el.versionNonce = 2;
    el.width = 80;
    el.height = 40;

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [el]);

    expect(updates).toBeGreaterThan(0);
    const stored = ymap.get("x");
    expect(stored?.versionNonce).toBe(2);
    expect(stored?.width).toBe(80);
  });

  it("decouples Y.Map storage from the caller's object after set", () => {
    const { doc, ymap } = makeDoc();
    const el: ElementJson = { id: "x", versionNonce: 1 };
    applyElementsToYMap(doc, ymap, [el]);
    el.versionNonce = 999;
    expect(ymap.get("x")?.versionNonce).toBe(1);
  });
});

describe("echo suppression (regression: peer's drag snaps back)", () => {
  it("does not write when only versionNonce changed but content is identical", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 1, x: 100, y: 100 },
    ]);

    let updates = 0;
    doc.on("update", () => updates++);
    // Excalidraw bumps versionNonce while applying an inbound scene update
    // even though the visible state is unchanged. Without echo suppression
    // we'd write this back to the peer mid-drag.
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 999, x: 100, y: 100 },
    ]);
    expect(updates).toBe(0);
  });

  it("still writes when content actually changed (different x/y)", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 1, x: 100, y: 100 },
    ]);

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 2, x: 200, y: 100 },
    ]);
    expect(updates).toBeGreaterThan(0);
    expect(ymap.get("x")?.x).toBe(200);
  });

  it("ignores `version` field drift the same way", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 1, version: 1, x: 0 },
    ]);

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 2, version: 5, x: 0 },
    ]);
    expect(updates).toBe(0);
  });

  it("ignores `updated` timestamp drift (the field Excalidraw bumps when applying inbound updateScene)", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 1, updated: 1000, x: 50 },
    ]);

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 2, updated: 9999, x: 50 },
    ]);
    expect(updates).toBe(0);
  });

  it("ignores `seed` drift", () => {
    const { doc, ymap } = makeDoc();
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 1, seed: 111, x: 0 },
    ]);

    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [
      { id: "x", versionNonce: 2, seed: 222, x: 0 },
    ]);
    expect(updates).toBe(0);
  });

  it("simulates the full peer-drag echo path: B drags, A's stamp comes back, B holds", () => {
    // Models the snap-back bug end-to-end inside one doc.
    const { doc, ymap } = makeDoc();
    // Initial state: image at x=100.
    applyElementsToYMap(doc, ymap, [
      { id: "img", versionNonce: 1, version: 1, updated: 1000, x: 100, y: 0 },
    ]);

    // Peer B drags it to x=200 (real change).
    applyElementsToYMap(doc, ymap, [
      { id: "img", versionNonce: 2, version: 2, updated: 2000, x: 200, y: 0 },
    ]);
    expect(ymap.get("img")?.x).toBe(200);

    // Peer A's Excalidraw applied that update via updateScene, then
    // fired onChange with the same x=200 but with version/nonce/updated
    // re-stamped. The bridge MUST NOT echo this back.
    let updates = 0;
    doc.on("update", () => updates++);
    applyElementsToYMap(doc, ymap, [
      { id: "img", versionNonce: 3, version: 3, updated: 3000, x: 200, y: 0 },
    ]);
    expect(updates).toBe(0);
    expect(ymap.get("img")?.x).toBe(200);
  });
});

describe("applyFilesToYMap", () => {
  function makeFilesDoc() {
    const doc = new Y.Doc();
    const ymap = doc.getMap<FileJson>("files");
    return { doc, ymap };
  }

  it("inserts files keyed by id", () => {
    const { doc, ymap } = makeFilesDoc();
    applyFilesToYMap(doc, ymap, {
      f1: { id: "f1", dataURL: "data:a", mimeType: "image/png" },
      f2: { id: "f2", dataURL: "data:b", mimeType: "image/png" },
    });
    expect(ymap.size).toBe(2);
    expect(ymap.get("f1")?.dataURL).toBe("data:a");
  });

  it("never overwrites an existing entry by the same id", () => {
    const { doc, ymap } = makeFilesDoc();
    applyFilesToYMap(doc, ymap, {
      f1: { id: "f1", dataURL: "data:a" },
    });
    applyFilesToYMap(doc, ymap, {
      f1: { id: "f1", dataURL: "data:OVERWRITE" },
    });
    expect(ymap.get("f1")?.dataURL).toBe("data:a");
  });

  it("does not delete files missing from the input (insert-only)", () => {
    const { doc, ymap } = makeFilesDoc();
    applyFilesToYMap(doc, ymap, {
      f1: { id: "f1", dataURL: "data:a" },
      f2: { id: "f2", dataURL: "data:b" },
    });
    applyFilesToYMap(doc, ymap, {
      f1: { id: "f1", dataURL: "data:a" },
    });
    expect(ymap.has("f2")).toBe(true);
  });

  it("ignores entries without a string id", () => {
    const { doc, ymap } = makeFilesDoc();
    applyFilesToYMap(doc, ymap, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bogus: { dataURL: "x" } as any,
    });
    expect(ymap.size).toBe(0);
  });

  it("syncs files between two docs via Yjs updates", () => {
    const a = makeFilesDoc();
    const b = makeFilesDoc();
    applyFilesToYMap(a.doc, a.ymap, {
      f1: { id: "f1", dataURL: "data:a" },
    });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(readFilesFromYMap(b.ymap).map((f) => f.id)).toEqual(["f1"]);
  });
});

describe("Yjs round-trip between two docs", () => {
  it("converges to the same map after exchanging updates", () => {
    const a = makeDoc();
    const b = makeDoc();

    applyElementsToYMap(a.doc, a.ymap, [
      { id: "x", versionNonce: 1 },
      { id: "y", versionNonce: 1 },
    ]);
    applyElementsToYMap(b.doc, b.ymap, [{ id: "z", versionNonce: 1 }]);

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    const idsA = Array.from(a.ymap.keys()).sort();
    const idsB = Array.from(b.ymap.keys()).sort();
    expect(idsA).toEqual(idsB);
    expect(idsA).toEqual(["x", "y", "z"]);
  });
});
