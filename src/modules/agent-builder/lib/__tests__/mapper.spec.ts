import { describe, expect, it } from "vitest";
import { applyEdgeMappings, applyMapping, applyTransforms, runValidators } from "../mapper";

const source = {
  form: { values: { concurrency: "9", title: "Report 01" } },
  rows: [{ id: 1 }, { id: 2 }],
};

describe("applyMapping", () => {
  it("runs JSONPath + transforms + default + validators", () => {
    const result = applyMapping(source, {
      from: "$.form.values.concurrency",
      to: "concurrency",
      transforms: [{ kind: "to_number" }, { kind: "clamp", min: 1, max: 8 }],
      validators: [{ kind: "required" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(8); // clamped
    }
  });

  it("uses default when undefined", () => {
    const result = applyMapping(source, {
      from: "$.missing",
      to: "x",
      default: 5,
      validators: [{ kind: "required" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(5);
    }
  });
});

describe("applyTransforms", () => {
  it("runs through complex transform chain", () => {
    const initial = { nested: [{ name: "alpha" }, { name: "beta" }] };
    const transformed = applyTransforms(initial, [
      { kind: "pick", paths: ["$.nested[*].name"] },
      { kind: "merge", obj: { extra: true } },
      { kind: "to_string" },
    ]);
    expect(typeof transformed).toBe("string");
    expect(String(transformed)).toContain("extra");
  });

  it("coerces and clamps numeric values", () => {
    const transformed = applyTransforms("12.7", [
      { kind: "to_number" },
      { kind: "clamp", min: 5, max: 10 },
    ]);
    expect(transformed).toBe(10);
  });
});

describe("runValidators", () => {
  it("fails invalid values", () => {
    const result = runValidators("", [
      { kind: "required" },
      { kind: "regex", pattern: "^foo$" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });
});

describe("applyEdgeMappings", () => {
  it("reduces arrays with list_concat", () => {
    const result = applyEdgeMappings(source, [
      { from: "$.rows[*].id", to: "ids", reduce: "list_concat" },
      { from: "$.form.values.title", to: "title" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ ids: [1, 2], title: "Report 01" });
    }
  });
});
