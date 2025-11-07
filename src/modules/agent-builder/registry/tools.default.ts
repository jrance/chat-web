import type { ToolDef, ToolRegistry } from "../model/tools";

const TOOLS: ToolDef[] = [
  {
    id: "web.search",
    name: "Web Search",
    description: "General web search (serp adapter). Returns ranked web results.",
    runtime: "llm_tool",
    tags: ["search", "web"],
    variants: [
      {
        id: "simple",
        label: "Simple",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            max_results: { type: "number", default: 5 },
          },
          required: ["query"],
        },
      },
      {
        id: "advanced",
        label: "Advanced",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            time_limit: { type: "string", description: "e.g., d|w|m for day/week/month window" },
            region: { type: "string", description: "e.g., wt-wt" },
            safesearch: { type: "string", enum: ["off", "moderate", "strict"], default: "moderate" },
            max_results: { type: "number", default: 10 },
          },
          required: ["query"],
        },
      },
    ],
  },
  {
    id: "news.search",
    name: "News Search",
    description: "Search recent news across reputable sources.",
    runtime: "llm_tool",
    variants: [
      {
        id: "default",
        label: "Default",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            time_limit: { type: "string", description: "e.g., d|w|m" },
            max_results: { type: "number", default: 5 },
          },
          required: ["query"],
        },
      },
    ],
  },
  {
    id: "scores.lookup",
    name: "Scores Lookup",
    description: "Get latest sports scores or schedules.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string", enum: ["nba", "nfl", "mlb", "nhl", "epl"], description: "Sports league" },
        team: { type: "string", description: "Optional team code for filtering" },
        date: { type: "string", description: "YYYY-MM-DD optional" },
      },
      required: ["league"],
    },
  },
  {
    id: "sharepoint.search",
    name: "SharePoint Search",
    description: "Search SharePoint sites for files by keyword or metadata.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site id or path" },
        query: { type: "string" },
        mime_types: { type: "array", items: { type: "string" } },
        top: { type: "number", default: 10 },
      },
      required: ["site", "query"],
    },
  },
  {
    id: "onedrive.search",
    name: "OneDrive Search",
    description: "Search a OneDrive for files.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "User or drive id" },
        query: { type: "string" },
        top: { type: "number", default: 10 },
      },
      required: ["owner", "query"],
    },
  },
  {
    id: "s3.get_object",
    name: "S3 Get Object",
    description: "Fetch an object from S3, returning an artifact reference.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        bucket: { type: "string" },
        key: { type: "string" },
        version_id: { type: "string" },
      },
      required: ["bucket", "key"],
    },
  },
  {
    id: "http.get",
    name: "HTTP GET",
    description: "Make a GET request to a URL; returns status, headers, and body.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        timeout_ms: { type: "number", default: 10000 },
      },
      required: ["url"],
    },
  },
];

export const DefaultToolRegistry: ToolRegistry = {
  list: () => TOOLS.slice(),
  get: (id: string) => TOOLS.find((t) => t.id === id),
};
