import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyElementsToYMap,
  readElementsFromYMap,
  type ElementJson,
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
