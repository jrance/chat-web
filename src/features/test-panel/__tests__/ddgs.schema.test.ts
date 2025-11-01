import { describe, expect, it } from "vitest";
import { ddgsParamsSchema } from "../../tools/schemas/ddgs.schema";
import { DDGS_TOOL_DEF, TOOL_CATALOG } from "../../tools/catalog";

describe("ddgsParamsSchema", () => {
  it("applies defaults for missing fields", () => {
    const parsed = ddgsParamsSchema.parse({});
    expect(parsed).toEqual({
      query: "",
      vertical: "web",
      maxResults: 5,
      safesearch: "moderate",
      region: "us-en",
      timeLimit: "",
      siteFilter: [],
      mustInclude: [],
    });
  });

  it("enforces maxResults boundaries", () => {
    expect(ddgsParamsSchema.parse({ maxResults: 1 }).maxResults).toBe(1);
    expect(ddgsParamsSchema.parse({ maxResults: 50 }).maxResults).toBe(50);
    expect(() => ddgsParamsSchema.parse({ maxResults: 0 })).toThrow();
    expect(() => ddgsParamsSchema.parse({ maxResults: 51 })).toThrow();
  });

  it("rejects invalid enum values", () => {
    expect(() => ddgsParamsSchema.parse({ safesearch: "super-safe" as any })).toThrow();
    expect(() => ddgsParamsSchema.parse({ vertical: "shopping" as any })).toThrow();
    expect(() => ddgsParamsSchema.parse({ region: "mars-en" as any })).toThrow();
  });
});

describe("DDGS tool catalog entry", () => {
  it("is present in the tool catalog", () => {
    const entry = TOOL_CATALOG.find((tool) => tool.id === "tool:ddgs.search");
    expect(entry).toBeDefined();
  });

  it("matches snapshot", () => {
    expect(DDGS_TOOL_DEF).toMatchSnapshot();
  });
});

