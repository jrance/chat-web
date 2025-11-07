import { describe, expect, it } from "vitest";
import {
  addNode,
  basicCompat,
  checkPortCompat,
  connect,
  createEmptyDoc,
  moveNode,
  removeEdge,
  removeNode,
  updateNode,
  type CanvasState,
} from "../canvas";
import type { AgentNode, EntryFormNode, PublisherNode } from "../../model/ir";

function makeState(): CanvasState {
  return { doc: createEmptyDoc("test"), ui: {}, selection: null };
}

function entryNode(id = "entry"): EntryFormNode {
  return {
    id,
    kind: "entry.form",
    outputs: [
      { name: "messages", schema: { type: "array" } },
      { name: "form", schema: { type: "object" } },
      { name: "files", schema: { type: "array" } },
    ],
  };
}

function agentNode(id = "agent"): AgentNode {
  return {
    id,
    kind: "agent",
    config: { allowedTools: [] },
    inputs: [
      { name: "messages", schema: { type: "array" } },
      { name: "context", schema: { type: "object" } },
    ],
    outputs: [
      { name: "text", schema: { type: "string" } },
      { name: "output", schema: { type: "object" } },
    ],
  };
}

function publisherNode(id = "publisher"): PublisherNode {
  return {
    id,
    kind: "publisher",
    inputs: [
      { name: "artifact", schema: { type: "artifact" }, required: true },
    ],
    outputs: [{ name: "url", schema: { type: "string" } }],
  };
}

describe("canvas state helpers", () => {
  it("adds nodes with UI metadata and selection", () => {
    const state = addNode(makeState(), entryNode(), { x: 40, y: 60 });
    expect(state.doc.nodes).toHaveLength(1);
    expect(state.ui.entry.position).toEqual({ x: 40, y: 60 });
    expect(state.doc.nodes[0].meta).toMatchObject({ events: [] });
    expect(state.selection).toEqual({ nodeId: "entry" });
  });

  it("removes nodes along with attached edges", () => {
    let state = makeState();
    state = addNode(state, entryNode(), { x: 0, y: 0 });
    state = addNode(state, agentNode(), { x: 200, y: 0 });
    state = connect(state, { nodeId: "entry", port: "messages" }, { nodeId: "agent", port: "messages" });
    expect(state.doc.edges).toHaveLength(1);
    state = removeNode(state, "entry");
    expect(state.doc.nodes.find((n) => n.id === "entry")).toBeUndefined();
    expect(state.doc.edges).toHaveLength(0);
  });

  it("moves nodes by updating their UI coordinates only", () => {
    let state = addNode(makeState(), entryNode(), { x: 0, y: 0 });
    state = moveNode(state, "entry", { x: 120, y: 80 });
    expect(state.ui.entry.position).toEqual({ x: 120, y: 80 });
    expect(state.doc.nodes[0].id).toBe("entry");
  });

  it("updates node configs immutably", () => {
    let state = addNode(makeState(), agentNode(), { x: 0, y: 0 });
    const updated = { ...state.doc.nodes[0], config: { allowedTools: ["sharepoint.upload"] } } as AgentNode;
    state = updateNode(state, updated);
    expect((state.doc.nodes[0] as AgentNode).config.allowedTools).toEqual(["sharepoint.upload"]);
  });

  it("connects compatible ports and blocks invalid combos", () => {
    let state = makeState();
    state = addNode(state, entryNode(), { x: 0, y: 0 });
    state = addNode(state, agentNode(), { x: 200, y: 0 });
    state = addNode(state, publisherNode(), { x: 400, y: 0 });
    expect(checkPortCompat(state.doc, { nodeId: "entry", port: "messages" }, { nodeId: "agent", port: "messages" })).toBe("ok");
    state = connect(state, { nodeId: "entry", port: "messages" }, { nodeId: "agent", port: "messages" });
    expect(state.doc.edges).toHaveLength(1);
    expect(checkPortCompat(state.doc, { nodeId: "entry", port: "messages" }, { nodeId: "publisher", port: "artifact" })).toBe("block");
    const next = connect(state, { nodeId: "entry", port: "messages" }, { nodeId: "publisher", port: "artifact" });
    expect(next.doc.edges).toHaveLength(1); // block mismatched artifact edge
  });

  it("can remove edges", () => {
    let state = makeState();
    state = addNode(state, entryNode(), { x: 0, y: 0 });
    state = addNode(state, agentNode(), { x: 200, y: 0 });
    state = connect(state, { nodeId: "entry", port: "messages" }, { nodeId: "agent", port: "messages" });
    const [edge] = state.doc.edges;
    state = removeEdge(state, edge.id);
    expect(state.doc.edges).toHaveLength(0);
  });
});

describe("basicCompat", () => {
  it("returns ok for identical types", () => {
    expect(basicCompat("array", "array")).toBe("ok");
  });

  it("warns when one type missing", () => {
    expect(basicCompat(undefined, "string")).toBe("warn");
  });

  it("warns for soft object/array conversions", () => {
    expect(basicCompat("object", "array")).toBe("warn");
  });

  it("blocks artifact mismatch", () => {
    expect(basicCompat("artifact", "string")).toBe("block");
  });
});
