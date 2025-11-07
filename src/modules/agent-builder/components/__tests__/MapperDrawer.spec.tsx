import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { MapperDrawer } from "../MapperDrawer";

const doc = {
  version: "0.3",
  id: "graph",
  name: "Test graph",
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
      inputs: [{ name: "context", schema: { type: "object" } }],
    },
  ],
  edges: [
    {
      id: "edge_1",
      from: { nodeId: "entry", port: "form" },
      to: { nodeId: "agent", port: "context" },
      mappings: [],
    },
  ],
} as any;

describe("MapperDrawer", () => {
  it("adds mapping rows and saves", () => {
    const onChange = vi.fn();
    render(
      <MapperDrawer
        doc={doc}
        edgeId="edge_1"
        upstreamPreview={{ form: { values: { concurrency: "7" } } }}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("+ Add mapping"));
    const pathInput = screen.getByPlaceholderText("$.form.values.concurrency");
    fireEvent.change(pathInput, { target: { value: "$.form.values.concurrency" } });
    const toInput = screen.getByPlaceholderText("concurrency");
    fireEvent.change(toInput, { target: { value: "concurrency" } });
    fireEvent.click(screen.getByText("Save"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const mappings = onChange.mock.calls[0][0];
    expect(mappings).toHaveLength(1);
    expect(mappings[0].from).toBe("$.form.values.concurrency");
    expect(mappings[0].to).toBe("concurrency");
  });
});
