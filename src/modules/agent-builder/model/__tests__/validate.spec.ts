import { describe, it, expect } from "vitest";

import { IR_VERSION } from "../ir";
import { validateGraphDoc } from "../validate";

const baseEntryNode = {
  id: "entry",
  kind: "entry.form" as const,
  outputs: [
    { name: "messages", schema: { type: "array" as const } },
    { name: "form", schema: { type: "object" as const } },
    { name: "files", schema: { type: "array" as const } }
  ]
};

describe("graphDocZ", () => {
  it("validates a minimal graph", () => {
    const doc = {
      version: IR_VERSION,
      id: "g1",
      name: "Minimal",
      nodes: [baseEntryNode],
      edges: []
    };
    const result = validateGraphDoc(doc);
    expect(result.success).toBe(true);
  });

  it("rejects a graph with malformed mappings", () => {
    const doc = {
      version: IR_VERSION,
      id: "g2",
      name: "Bad mappings",
      nodes: [baseEntryNode, { id: "agent", kind: "agent" as const }],
      edges: [
        {
          id: "edge",
          from: { nodeId: "entry", port: "form" },
          to: { nodeId: "agent", port: "messages" },
          mappings: [{ from: "", to: "" }]
        }
      ]
    };
    const result = validateGraphDoc(doc);
    expect(result.success).toBe(false);
  });
});
