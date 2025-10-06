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
      { name: "indexName", type: "string", default: "policy-kb", scope: "AgentOverride" },
      { name: "topK", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride" },
    ],
    status: "active",
    description: "Searches the enterprise policy KB",
  },
  {
    id: "tool:web-search",
    name: "Web Search",
    version: "1.4.3",
    category: "search",
    auth: { type: "api_key", scopes: ["web.search"] },
    transport: { kind: "http", endpoint: "https://search.example.com/query" },
    parameters: [
      { name: "region", type: "enum", enum: ["us", "eu"], default: "us", scope: "OrgLocked" },
      { name: "topK", type: "number", default: 3, min: 1, max: 10, scope: "AgentOverride" },
    ],
    status: "active",
    description: "Performs a web search against the enterprise provider",
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

