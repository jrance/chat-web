import { fireEvent, render, screen, within } from "@testing-library/react";
import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { BuilderCanvas, type BuilderCanvasHandle } from "../BuilderCanvas";
import { NodePalette } from "../NodePalette";

function Harness({ onEdgeSelected }: { onEdgeSelected?: (edgeId: string) => void }) {
  const ref = useRef<BuilderCanvasHandle>(null);
  return (
    <div>
      <NodePalette onCreate={(node) => ref.current?.add(node)} />
      <BuilderCanvas ref={ref} width={800} height={600} onEdgeSelected={onEdgeSelected} />
    </div>
  );
}

describe("BuilderCanvas", () => {
  it("adds nodes from palette and connects ports", () => {
    render(<Harness />);
    const palette = screen.getByRole("list");
    const entryButton = within(palette).getByRole("button", { name: /Entry \(Chat\/Form\)/i });
    const agentButton = within(palette).getByRole("button", { name: /^Agent/i });
    fireEvent.click(entryButton);
    fireEvent.click(agentButton);

    const outMessages = screen.getByLabelText("out port messages");
    const inMessages = screen.getByLabelText("in port messages");
    fireEvent.click(outMessages);
    fireEvent.click(inMessages);

    const edgeList = screen.getByRole("list", { name: "Edges" });
    expect(within(edgeList).getAllByRole("listitem")).toHaveLength(1);
  });

  it("allows selecting and removing edges", () => {
    const onEdgeSelected = vi.fn();
    render(<Harness onEdgeSelected={onEdgeSelected} />);
    const palette = screen.getByRole("list");
    const entryButton = within(palette).getByRole("button", { name: /Entry \(Chat\/Form\)/i });
    const agentButton = within(palette).getByRole("button", { name: /^Agent/i });
    fireEvent.click(entryButton);
    fireEvent.click(agentButton);

    fireEvent.click(screen.getByLabelText("out port messages"));
    fireEvent.click(screen.getByLabelText("in port messages"));

    const edgeList = screen.getByRole("list", { name: "Edges" });
    const edgeButton = within(edgeList).getByRole("button", { name: /->/ });
    fireEvent.click(edgeButton);
    expect(onEdgeSelected).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("remove edge"));
    expect(within(edgeList).queryAllByRole("listitem")).toHaveLength(0);
  });
});

