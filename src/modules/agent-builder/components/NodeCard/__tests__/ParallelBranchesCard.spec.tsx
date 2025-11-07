import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParallelBranchesCard } from "../ParallelBranchesCard";

const allNodes = [
  { id: "child_a", kind: "agent", name: "Child A" },
  { id: "child_b", kind: "agent", name: "Child B" },
] as any;

describe("ParallelBranchesCard", () => {
  it("toggles children and broadcast options", () => {
    const node: any = {
      id: "parent",
      kind: "parallel.branches",
      config: { children: [], broadcast: ["messages"], join: "all" },
    };
    const onChange = (next: any) => Object.assign(node, next);

    render(
      <ParallelBranchesCard
        node={node}
        onChange={onChange}
        allNodes={allNodes}
        onOpenWireWizard={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Child A/));
    expect(node.config.children).toContain("child_a");

    fireEvent.click(screen.getByLabelText(/context/));
    expect(node.config.broadcast).toContain("context");
  });
});
