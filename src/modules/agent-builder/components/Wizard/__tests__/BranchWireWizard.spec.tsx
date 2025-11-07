import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BranchWireWizard } from "../BranchWireWizard";

const doc: any = {
  version: "0.3",
  id: "graph",
  name: "Test",
  nodes: [
    {
      id: "p",
      kind: "parallel.branches",
      config: { children: ["c1", "c2"], broadcast: ["messages"], join: "all" },
      outputs: [{ name: "evidence", schema: { type: "array", reducer: "list_concat" } }],
    },
    { id: "c1", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }], outputs: [{ name: "output", schema: { type: "object" } }] },
    { id: "c2", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }], outputs: [{ name: "output", schema: { type: "object" } }] },
  ],
  edges: [],
};

describe("BranchWireWizard", () => {
  it("creates forward and fan-in edges for each child", () => {
    const onApply = vi.fn();
    render(<BranchWireWizard doc={doc} parentId="p" onApply={onApply} onClose={() => {}} />);

    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalled();
    const edges = onApply.mock.calls[0][0];
    expect(edges).toHaveLength(4);
    expect(edges.filter((edge: any) => edge.from.nodeId === "p")).toHaveLength(2);
    expect(edges.filter((edge: any) => edge.to.nodeId === "p")).toHaveLength(2);
  });
});
