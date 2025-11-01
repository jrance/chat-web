import { describe, expect, it } from "vitest";
import { migrateWebSearchToDdgs } from "../src/features/tools/migrations/007_ddgs_migrate";

describe("migrateWebSearchToDdgs", () => {
  it("returns tool untouched when not web-search", () => {
    const tool = { id: "tool:other", parameters: { foo: "bar" } };
    expect(migrateWebSearchToDdgs(tool as any)).toBe(tool);
  });

  it("maps legacy fields to ddgs configuration", () => {
    const migrated = migrateWebSearchToDdgs({
      id: "tool:web-search",
      name: "Web Search",
      version: "1.2.3",
      auth: { type: "api_key" },
      transport: { kind: "http", endpoint: "https://example.com" },
      parameters: {
        query: "latest news",
        region: "us",
        topK: 12,
      },
    } as any);

    expect(migrated.id).toBe("tool:ddgs.search");
    expect(migrated.name).toBe("DuckDuckGo Search");
    expect(migrated.version).toBe("0.1.0");
    expect(migrated.auth).toEqual({ type: "none" });
    expect(migrated.transport).toEqual({ kind: "engine", toolId: "tool:ddgs.search" });
    expect(migrated.parameters).toEqual({
      query: "latest news",
      vertical: "web",
      maxResults: 12,
      safesearch: "moderate",
      region: "us-en",
      timeLimit: "",
      siteFilter: [],
      mustInclude: [],
    });
  });

  it("normalizes legacy region aliases and topK edge cases", () => {
    const migrated = migrateWebSearchToDdgs({
      id: "tool:web-search",
      parameters: {
        region: "EU",
        topK: 99,
      },
    } as any);

    expect((migrated as any).parameters.region).toBe("wt-wt");
    expect((migrated as any).parameters.maxResults).toBe(50);
  });
});

