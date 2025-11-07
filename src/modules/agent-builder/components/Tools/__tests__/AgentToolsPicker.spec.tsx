import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentToolsPicker } from "../AgentToolsPicker";
import type { AgentNode } from "../../../model/ir";
import type { ToolRegistry } from "../../../model/tools";

const registry: ToolRegistry = {
  list: () => [
    {
      id: "web.search",
      name: "Web Search",
      description: "",
      runtime: "llm_tool",
      variants: [
        {
          id: "simple",
          label: "Simple",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
      ],
    },
  ],
  get: () => undefined,
};

describe("AgentToolsPicker", () => {
  it("selects a tool and variant", () => {
    const node: AgentNode = {
      id: "a",
      kind: "agent",
      config: { allowedTools: [] },
    };
    const onChange = (next: AgentNode) => Object.assign(node, next);

    render(<AgentToolsPicker node={node} onChange={onChange} registry={registry} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(node.config.allowedTools?.[0].toolId).toBe("web.search");

    const select = screen.getByLabelText("Variant");
    fireEvent.change(select, { target: { value: "simple" } });
    expect(node.config.allowedTools?.[0].variantId).toBe("simple");
  });
});
