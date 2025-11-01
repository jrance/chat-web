import type { ToolMeta } from "../shapes";

const meta: ToolMeta = {
  toolId: "tool:ddgs.search",
  name: "DuckDuckGo Search",
  version: "0.1.0",
  summary: "Free, keyless search via DuckDuckGo verticals (web, news, Wikipedia).",
  argsSchema: [
    { kind: "string", name: "query", label: "Search query", placeholder: "What should the agent look up?", required: true },
    { kind: "string", name: "vertical", label: "Vertical", enum: ["web", "news", "wikipedia"], visibility: "AgentOverride" },
    { kind: "number", name: "maxResults", label: "Max results", min: 1, max: 50, step: 1, visibility: "AgentOverride" },
    { kind: "string", name: "safesearch", label: "Safe search", enum: ["off", "moderate", "strict"], visibility: "AgentOverride" },
    { kind: "string", name: "region", label: "Region", enum: ["us-en", "uk-en", "wt-wt", "de-de", "fr-fr", "es-es", "it-it", "nl-nl", "in-en", "jp-jp"], visibility: "AgentOverride" },
    { kind: "string", name: "timeLimit", label: "Freshness window", enum: ["", "d", "w", "m", "y"], visibility: "AgentOverride" },
    { kind: "string[]", name: "siteFilter", label: "Site filter", placeholder: "reuters.com", visibility: "AgentOverride" },
    { kind: "string[]", name: "mustInclude", label: "Must include terms", placeholder: "keyword", visibility: "AgentOverride" }
  ],
  defaults: {
    query: "",
    vertical: "web",
    maxResults: 5,
    safesearch: "moderate",
    region: "us-en",
    timeLimit: "",
    siteFilter: [],
    mustInclude: []
  }
};

export default meta;
