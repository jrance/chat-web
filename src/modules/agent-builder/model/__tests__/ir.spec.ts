import { describe, it, expect } from "vitest";

import { IR_VERSION, GraphDoc } from "../ir";

describe("IR v0.3", () => {
  it("exports the expected version constant", () => {
    expect(IR_VERSION).toBe("0.3");
  });

  it("accepts a minimal GraphDoc shape at compile-time", () => {
    const doc: GraphDoc = {
      version: "0.3",
      id: "graph1",
      name: "Demo",
      nodes: [
        {
          id: "entry",
          kind: "entry.form",
          outputs: [
            { name: "messages", schema: { type: "array" } },
            { name: "form", schema: { type: "object" } },
            { name: "files", schema: { type: "array" } }
          ]
        }
      ],
      edges: []
    };
    expect(doc.name).toBe("Demo");
  });
});
