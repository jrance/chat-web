import type { ToolsClient, ToolsListQuery, ToolDefinition } from "../types/tools";

const MOCK_TOOLS: ToolDefinition[] = [
  {
    id: "tool:policy-search",
    name: "Policy Search",
    version: "2.1.0",
    category: "search",
    auth: { type: "OBO", scopes: ["kb.read"] },
    transport: { kind: "http", endpoint: "https://kb.example.com/api/search" },
    parameters: [
      { name: "query", type: "string", description: "Search query", scope: "AgentOverride", default: "" },
      { name: "indexName", type: "string", default: "policy-kb", scope: "AgentOverride" },
      { name: "topK", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride" },
    ],
    status: "active",
    description: "Searches the enterprise policy KB",
  },
  {
    id: "tool:ddgs.search",
    name: "DuckDuckGo Search",
    version: "0.1.0",
    category: "search",
    auth: { type: "none" },
    transport: { kind: "engine", toolId: "tool:ddgs.search" },
    parameters: [
      { name: "query", type: "string", description: "Search query", scope: "AgentOverride", default: "" },
      { name: "vertical", type: "enum", enum: ["web", "news", "wikipedia"], default: "web", scope: "AgentOverride" },
      { name: "maxResults", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride" },
      { name: "safesearch", type: "enum", enum: ["off", "moderate", "strict"], default: "moderate", scope: "AgentOverride" },
      {
        name: "region",
        type: "enum",
        enum: ["us-en", "uk-en", "wt-wt", "de-de", "fr-fr", "es-es", "it-it", "nl-nl", "in-en", "jp-jp"],
        default: "us-en",
        scope: "OrgLocked"
      },
      { name: "timeLimit", type: "enum", enum: ["", "d", "w", "m", "y"], default: "", scope: "AgentOverride" },
      { name: "siteFilter", type: "array<string>", default: [], scope: "AgentOverride" },
      { name: "mustInclude", type: "array<string>", default: [], scope: "AgentOverride" }
    ],
    status: "active",
    description: "Keyless search across DuckDuckGo verticals.",
  },
  {
    id: "tool:sharepoint",
    name: "SharePoint Search",
    version: "3.0.0",
    category: "m365",
    auth: { type: "OBO", scopes: ["sp.search"] },
    transport: { kind: "http", endpoint: "https://graph.microsoft.com/sharepoint/search" },
    parameters: [
      { name: "siteCollection", type: "string", default: "root", scope: "AgentOverride" },
      { name: "topK", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride" },
    ],
    status: "active",
    description: "Search SharePoint content via Graph API",
  },
];

function applyQuery(items: ToolDefinition[], q?: ToolsListQuery): ToolDefinition[] {
  if (!q) return items;
  let out = items.slice();
  if (q.search) {
    const needle = q.search.toLowerCase();
    out = out.filter((t) =>
      t.id.toLowerCase().includes(needle) ||
      t.name.toLowerCase().includes(needle) ||
      (t.category || "").toLowerCase().includes(needle)
    );
  }
  if (q.authType) out = out.filter((t) => (t.auth?.type || "").toLowerCase() === q.authType!.toLowerCase());
  if (q.transport) out = out.filter((t) => (t.transport?.kind || "").toLowerCase() === q.transport!.toLowerCase());
  if (q.status) out = out.filter((t) => (t.status || "").toLowerCase() === q.status!.toLowerCase());
  return out;
}

export const mockToolsClient: ToolsClient = {
  async listTools(query) {
    const filtered = applyQuery(MOCK_TOOLS, query);
    console.log("[mockToolsClient.listTools]", { query, count: filtered.length });
    return { items: filtered, nextCursor: undefined };
  },
  async getTool(id: string) {
    const t = MOCK_TOOLS.find((x) => x.id === id);
    console.log("[mockToolsClient.getTool]", { id, found: !!t });
    return t;
  },
  async listPinnedTools() {
    return [];
  },
  async validateConnection(toolId: string) {
    console.log("[mockToolsClient.validateConnection]", { toolId });
    return { ok: true };
  },
  async listSecrets() {
    return ["tenant:secret/apikey-1", "tenant:secret/mtls-cert-1"];
  },
};
