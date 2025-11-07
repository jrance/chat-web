import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolSchemaViewer } from "../ToolSchemaViewer";

describe("ToolSchemaViewer", () => {
  it("shows schema and example", () => {
    const tool = {
      id: "t",
      name: "Tool",
      description: "",
      runtime: "llm_tool",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number" },
        },
      },
    };

    render(<ToolSchemaViewer tool={tool as any} />);

    fireEvent.click(screen.getByText(/Show Schema/i));
    expect(screen.getByText(/Parameters JSON Schema/)).toBeTruthy();
    expect(screen.getByText(/Example Arguments/)).toBeTruthy();
  });
});
