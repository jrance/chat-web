import type { ToolDefinition } from "../../modules/agent-builder/types/tools";

export const DDGS_TOOL_DEF: ToolDefinition = {
  id: "tool:ddgs.search",
  name: "DuckDuckGo Search",
  version: "0.1.0",
  category: "search",
  auth: { type: "none" },
  transport: { kind: "engine", toolId: "tool:ddgs.search" },
  parameters: [
    { name: "query", type: "string", description: "Search query", scope: "AgentOverride", default: "" },
    {
      name: "vertical",
      type: "enum",
      enum: ["web", "news", "wikipedia"],
      default: "web",
      scope: "AgentOverride",
      description: "Search vertical. 'wikipedia' is implemented via site:wikipedia.org filter on web."
    },
    {
      name: "maxResults",
      type: "number",
      default: 5,
      min: 1,
      max: 50,
      scope: "AgentOverride",
      description: "Maximum number of results to return."
    },
    {
      name: "safesearch",
      type: "enum",
      enum: ["off", "moderate", "strict"],
      default: "moderate",
      scope: "AgentOverride",
      description: "Content filtering level."
    },
    {
      name: "region",
      type: "enum",
      enum: ["us-en", "uk-en", "wt-wt", "de-de", "fr-fr", "es-es", "it-it", "nl-nl", "in-en", "jp-jp"],
      default: "us-en",
      scope: "OrgLocked",
      description: "Region/language targeting (DDG region code)."
    },
    {
      name: "timeLimit",
      type: "enum",
      enum: ["", "d", "w", "m", "y"],
      default: "",
      scope: "AgentOverride",
      description: "Freshness filter: d=day, w=week, m=month, y=year; empty means no limit."
    },
    {
      name: "siteFilter",
      type: "array<string>",
      default: [],
      scope: "AgentOverride",
      description: "Restrict search to these hostnames (e.g., ['reuters.com','apnews.com'])."
    },
    {
      name: "mustInclude",
      type: "array<string>",
      default: [],
      scope: "AgentOverride",
      description: "Discard results that do not include these terms in title/snippet."
    }
  ],
  status: "active",
  description: "Free, keyless search via DuckDuckGo (ddgs). Supports web, news, and Wikipedia-only queries."
};

export const TOOL_CATALOG: ToolDefinition[] = [DDGS_TOOL_DEF];

export const TOOL_CATALOG_INDEX: Record<string, ToolDefinition> = TOOL_CATALOG.reduce((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {} as Record<string, ToolDefinition>);

