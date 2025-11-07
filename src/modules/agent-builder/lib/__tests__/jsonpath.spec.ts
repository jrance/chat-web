import { describe, expect, it } from "vitest";
import { evalJsonPath } from "../jsonpath";

describe("evalJsonPath (fallback subset)", () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }], d: { e: 3 } } };

  it("reads simple path", () => {
    expect(evalJsonPath(obj, "$.a.d.e")).toEqual([3]);
  });

  it("reads array index", () => {
    expect(evalJsonPath(obj, "$.a.b[0].c")).toEqual([1]);
  });

  it("reads wildcard array", () => {
    expect(evalJsonPath(obj, "$.a.b[*].c")).toEqual([1, 2]);
  });
});
