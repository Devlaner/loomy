import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { decodeYjsUpdate, encodeYjsDoc } from "./yjs-persistence";

describe("Yjs persistence round-trip", () => {
  it("restores the original doc from an encoded blob", () => {
    const source = new Y.Doc();
    const map = source.getMap<unknown>("elements");
    map.set("a", { id: "a", x: 10 });
    map.set("b", { id: "b", x: 20 });

    const blob = encodeYjsDoc(source);
    expect(typeof blob).toBe("string");
    expect(blob.length).toBeGreaterThan(0);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, decodeYjsUpdate(blob));

    const restoredMap = restored.getMap<unknown>("elements");
    expect(restoredMap.get("a")).toEqual({ id: "a", x: 10 });
    expect(restoredMap.get("b")).toEqual({ id: "b", x: 20 });
  });

  it("handles large docs without stack overflow", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<number>("nums");
    arr.push(Array.from({ length: 20_000 }, (_, i) => i));

    const blob = encodeYjsDoc(doc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, decodeYjsUpdate(blob));
    expect(restored.getArray<number>("nums").length).toBe(20_000);
  });

  it("round-trips an empty doc", () => {
    const empty = new Y.Doc();
    const blob = encodeYjsDoc(empty);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, decodeYjsUpdate(blob));
    expect(restored.getMap("elements").size).toBe(0);
  });
});
