import { describe, it, expect } from "vitest";
import { listTools, getToolById } from "../src/lib/tools/registry";

describe("Tools Registry", () => {
  it("should return all registered tools", () => {
    const tools = listTools();
    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should include Web Search tool", () => {
    const tools = listTools();
    const webSearch = tools.find((t) => t.toolId === "tool:web-search");
    expect(webSearch).toBeDefined();
    expect(webSearch?.name).toBe("Web Search");
    expect(webSearch?.version).toBe("1.0.0");
  });

  it("should retrieve tool by ID", () => {
    const webSearch = getToolById("tool:web-search");
    expect(webSearch).toBeDefined();
    expect(webSearch?.toolId).toBe("tool:web-search");
  });

  it("should return undefined for unknown tool ID", () => {
    const unknown = getToolById("tool:does-not-exist");
    expect(unknown).toBeUndefined();
  });

  describe("Web Search metadata", () => {
    it("should have correct default values", () => {
      const webSearch = getToolById("tool:web-search");
      expect(webSearch?.defaults).toBeDefined();
      expect(webSearch?.defaults?.limit).toBe(5);
      expect(webSearch?.defaults?.safeSearch).toBe(true);
      expect(webSearch?.defaults?.recency).toBe("30d");
    });

    it("should have args schema with required fields", () => {
      const webSearch = getToolById("tool:web-search");
      expect(webSearch?.argsSchema).toBeInstanceOf(Array);
      expect(webSearch?.argsSchema.length).toBeGreaterThan(0);

      const queryArg = webSearch?.argsSchema.find((a) => a.name === "query");
      expect(queryArg).toBeDefined();
      expect(queryArg?.kind).toBe("string");
      expect((queryArg as any)?.required).toBe(true);
    });

    it("should have LLMHidden visibility for apiKeyRef", () => {
      const webSearch = getToolById("tool:web-search");
      const apiKeyRef = webSearch?.argsSchema.find((a) => a.name === "apiKeyRef");
      expect(apiKeyRef).toBeDefined();
      expect((apiKeyRef as any)?.visibility).toBe("LLMHidden");
    });

    it("should have AgentOverride visibility for site, recency, limit, safeSearch", () => {
      const webSearch = getToolById("tool:web-search");
      const agentOverrideFields = ["site", "recency", "limit", "safeSearch"];

      for (const fieldName of agentOverrideFields) {
        const field = webSearch?.argsSchema.find((a) => a.name === fieldName);
        expect(field, `${fieldName} should exist`).toBeDefined();
        expect((field as any)?.visibility, `${fieldName} should be AgentOverride`).toBe("AgentOverride");
      }
    });

    it("should have correct types for args", () => {
      const webSearch = getToolById("tool:web-search");

      const query = webSearch?.argsSchema.find((a) => a.name === "query");
      expect(query?.kind).toBe("string");

      const limit = webSearch?.argsSchema.find((a) => a.name === "limit");
      expect(limit?.kind).toBe("number");
      expect((limit as any)?.min).toBe(1);
      expect((limit as any)?.max).toBe(20);

      const safeSearch = webSearch?.argsSchema.find((a) => a.name === "safeSearch");
      expect(safeSearch?.kind).toBe("boolean");
    });
  });
});
