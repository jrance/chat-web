import { describe, it, expect } from "vitest";
import { listTools, getToolById } from "../src/lib/tools/registry";

const TOOL_ID = "tool:ddgs.search";

describe("Tools Registry", () => {
  it("should return all registered tools", () => {
    const tools = listTools();
    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should include DuckDuckGo Search tool", () => {
    const tools = listTools();
    const ddgs = tools.find((t) => t.toolId === TOOL_ID);
    expect(ddgs).toBeDefined();
    expect(ddgs?.name).toBe("DuckDuckGo Search");
    expect(ddgs?.version).toBe("0.1.0");
  });

  it("should retrieve tool by ID", () => {
    const ddgs = getToolById(TOOL_ID);
    expect(ddgs).toBeDefined();
    expect(ddgs?.toolId).toBe(TOOL_ID);
  });

  it("should return undefined for unknown tool ID", () => {
    const unknown = getToolById("tool:does-not-exist");
    expect(unknown).toBeUndefined();
  });

  describe("DuckDuckGo Search metadata", () => {
    it("should expose expected defaults", () => {
      const ddgs = getToolById(TOOL_ID);
      expect(ddgs?.defaults).toBeDefined();
      expect(ddgs?.defaults?.query).toBe("");
      expect(ddgs?.defaults?.vertical).toBe("web");
      expect(ddgs?.defaults?.maxResults).toBe(5);
      expect(ddgs?.defaults?.safesearch).toBe("moderate");
      expect(ddgs?.defaults?.region).toBe("us-en");
      expect(ddgs?.defaults?.timeLimit).toBe("");
      expect(ddgs?.defaults?.siteFilter).toEqual([]);
      expect(ddgs?.defaults?.mustInclude).toEqual([]);
    });

    it("should have args schema with required fields and enums", () => {
      const ddgs = getToolById(TOOL_ID);
      expect(ddgs?.argsSchema).toBeInstanceOf(Array);
      expect(ddgs?.argsSchema.length).toBeGreaterThan(0);

      const queryArg = ddgs?.argsSchema.find((a) => a.name === "query");
      expect(queryArg).toBeDefined();
      expect(queryArg?.kind).toBe("string");
      expect((queryArg as any)?.required).toBe(true);

      const vertical = ddgs?.argsSchema.find((a) => a.name === "vertical");
      expect(vertical?.kind).toBe("string");
      expect((vertical as any)?.enum).toEqual(["web", "news", "wikipedia"]);

      const safesearch = ddgs?.argsSchema.find((a) => a.name === "safesearch");
      expect(safesearch?.kind).toBe("string");
      expect((safesearch as any)?.enum).toEqual(["off", "moderate", "strict"]);

      const region = ddgs?.argsSchema.find((a) => a.name === "region");
      expect(region?.kind).toBe("string");
      expect((region as any)?.enum).toContain("us-en");

      const maxResults = ddgs?.argsSchema.find((a) => a.name === "maxResults");
      expect(maxResults?.kind).toBe("number");
      expect((maxResults as any)?.min).toBe(1);
      expect((maxResults as any)?.max).toBe(50);
    });

    it("should surface tag-list friendly arrays", () => {
      const ddgs = getToolById(TOOL_ID);
      const siteFilter = ddgs?.argsSchema.find((a) => a.name === "siteFilter");
      const mustInclude = ddgs?.argsSchema.find((a) => a.name === "mustInclude");
      expect(siteFilter?.kind).toBe("string[]");
      expect(mustInclude?.kind).toBe("string[]");
      expect((siteFilter as any)?.visibility).toBe("AgentOverride");
      expect((mustInclude as any)?.visibility).toBe("AgentOverride");
    });
  });
});
