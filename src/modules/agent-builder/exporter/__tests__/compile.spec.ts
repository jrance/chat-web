import { describe, expect, it } from "vitest";
import { compileGraph } from "../compile";

describe("compileGraph", () => {
  it("indexes nodes and edges into EngineGraph", () => {
    const doc: any = {
      id: "g1",
      name: "Graph",
      nodes: [
        {
          id: "entry",
          kind: "entry.form",
          outputs: [
            { name: "messages", schema: { type: "array" } },
            { name: "form", schema: { type: "object" } },
            { name: "files", schema: { type: "array" } },
          ],
        },
        {
          id: "agent",
          kind: "agent",
          inputs: [{ name: "messages", schema: { type: "array" } }],
        },
      ],
      edges: [
        {
          id: "edge1",
          from: { nodeId: "entry", port: "messages" },
          to: { nodeId: "agent", port: "messages" },
          mappings: [{ from: "$.messages", to: "messages" }],
        },
      ],
    };
    const { graph, warnings } = compileGraph(doc);
    expect(graph.nodes.entry.kind).toBe("entry.form");
    expect(graph.edges).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("warns when ports are invalid", () => {
    const doc: any = {
      id: "g2",
      name: "Graph",
      nodes: [{ id: "agent", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }] }],
      edges: [
        {
          id: "edge2",
          from: { nodeId: "agent", port: "missing" },
          to: { nodeId: "agent", port: "messages" },
          mappings: [{ from: "$", to: "messages" }],
        },
      ],
    };
    const { warnings } = compileGraph(doc);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
