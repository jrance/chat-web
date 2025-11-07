import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentCard } from "../AgentCard";

describe("AgentCard combiner mode", () => {
  it("adds evidence input when enabled", () => {
    const node: any = {
      id: "agent",
      kind: "agent",
      config: {},
      inputs: [
        { name: "messages", schema: { type: "array" } },
        { name: "context", schema: { type: "object" } },
      ],
    };
    const onChange = (next: any) => Object.assign(node, next);

    render(<AgentCard node={node} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/Combiner mode/));
    expect(node.inputs.some((port: any) => port.name === "evidence")).toBe(true);
  });
});
