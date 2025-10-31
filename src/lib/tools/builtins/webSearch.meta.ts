import type { ToolMeta } from "../shapes";

const meta: ToolMeta = {
  toolId: "tool:web-search",
  name: "Web Search",
  version: "1.0.0",
  summary: "Searches the public web and returns results with titles, urls, and snippets.",
  argsSchema: [
    { kind: "string", name: "query", label: "Query", placeholder: "What do you want to find?", required: true },
    { kind: "string", name: "site", label: "Site (optional)", placeholder: "example.com", visibility: "AgentOverride" },
    { kind: "string", name: "recency", label: "Recency Window", placeholder: "30d | 7d | 0", visibility: "AgentOverride" },
    { kind: "number", name: "limit", label: "Max Results", min: 1, max: 20, step: 1, visibility: "AgentOverride" },
    { kind: "boolean", name: "safeSearch", label: "Safe Search", visibility: "AgentOverride" },
    // Example of a value not sent to the LLM:
    { kind: "string", name: "apiKeyRef", label: "API Key Ref", visibility: "LLMHidden", placeholder: "secrets/search-api" }
  ],
  defaults: { limit: 5, safeSearch: true, recency: "30d" }
};

export default meta;
