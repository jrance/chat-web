import { describe, it, expect } from "vitest";
import { exampleFromSchema } from "../schema_example";

describe("exampleFromSchema", () => {
  it("creates object examples", () => {
    const schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "number" },
        c: { type: "boolean" },
        d: { type: "array", items: { type: "string" } },
      },
    };

    const result = exampleFromSchema(schema);

    expect(typeof result.a).toBe("string");
    expect(typeof result.b).toBe("number");
    expect(typeof result.c).toBe("boolean");
    expect(Array.isArray(result.d)).toBe(true);
  });
});
