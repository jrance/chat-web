import { describe, expect, it } from "vitest";
import { extractOpenAiTools } from "../extract_tools";

const registry = {
  list: () => [],
  get: (id: string) =>
    ({
      id,
      name: id,
      description: "desc",
      runtime: "llm_tool",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    }) as any,
} as any;

describe("extractOpenAiTools", () => {
  it("deduplicates tools from agent selections", () => {
    const doc: any = {
      id: "g",
      name: "graph",
      nodes: [
        { id: "a", kind: "agent", config: { allowedTools: [{ toolId: "web.search" }] } },
        {
          id: "b",
          kind: "agent",
          config: { allowedTools: [{ toolId: "web.search" }, { toolId: "news.search", variantId: "default" }] },
        },
      ],
      edges: [],
    };
    const tools = extractOpenAiTools(doc, registry);
    expect(tools).toHaveLength(2);
    expect(tools[0].type).toBe("function");
  });
});
