export type ToolParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "array<string>" | "array<number>" | "object";
  default?: any;
  description?: string;
  scope: "AgentOverride" | "OrgLocked" | "LLMHidden";
  enum?: string[];
  min?: number;
  max?: number;
};

export type ToolDefinition = {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  category?: string;
  owner?: string;
  description?: string;
  auth?: { type?: "OBO" | "client_credentials" | "api_key" | "mtls" | "none" };
  status?: "active" | "deprecated" | "retired";
  parameters?: ToolParameter[];
  argsSchema?: Record<string, any>;
  responseSchema?: Record<string, any>;
  transport?: {
    kind: "http" | "grpc" | "mcp" | "kafka" | "local";
    endpoint?: string;
    method?: string;
    headersTemplate?: Record<string, any>;
    requestTemplate?: Record<string, any>;
    responsePointer?: string;
    timeoutMsDefault?: number;
    retry?: { maxAttempts?: number; backoff?: "none" | "exponential" | "fixed"; initialDelayMs?: number };
  };
  approval?: { orgApproved?: boolean; riskTier?: "low" | "medium" | "high" };
  quotas?: { rateLimitPerMin?: number; burst?: number };
  tenancy?: { visibility?: "tenant" | "global"; allowedTenants?: string[] };
  lifecycle?: { status?: "active" | "deprecated" | "retired"; deprecates?: string; retireAfter?: string };
  metadata?: { docsUrl?: string };
};

export const SAMPLE_TENANT_CATALOG: ToolDefinition[] = [
  {
    id: "tool-search-policies",
    name: "search_policies",
    displayName: "Policy Search",
    version: "2.1.0",
    category: "Search",
    owner: "policy-team",
    description: "Searches the enterprise policy KB",
    auth: { type: "OBO" },
    status: "active",
    parameters: [
      { name: "query", type: "string", description: "Search query", scope: "AgentOverride", default: "" },
      { name: "indexName", type: "string", default: "policy-kb", description: "Search index to query", scope: "AgentOverride" },
      { name: "topK", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride" },
      { name: "region", type: "enum", enum: ["us", "eu"], default: "us", scope: "OrgLocked" },
    ],
    argsSchema: {},
    responseSchema: {},
    transport: {
      kind: "http",
      endpoint: "https://kb.example.com/api/search",
      method: "POST",
      headersTemplate: { "x-tenant-id": "{{tenantId}}" },
      requestTemplate: {},
      responsePointer: "/results",
      timeoutMsDefault: 10000,
      retry: { maxAttempts: 2, backoff: "exponential", initialDelayMs: 200 },
    },
    approval: { orgApproved: true, riskTier: "low" },
    quotas: { rateLimitPerMin: 600, burst: 120 },
    tenancy: { visibility: "tenant", allowedTenants: ["acme"] },
    lifecycle: { status: "active", deprecates: "1.x", retireAfter: "2026-06-01" },
    metadata: { docsUrl: "https://example.com/docs/search-policies" },
  },
  {
    id: "tool-web-fetch",
    name: "web_fetch",
    displayName: "Web Fetch",
    version: "1.3.0",
    category: "HTTP",
    owner: "platform",
    description: "Fetches content from the web over HTTP",
    auth: { type: "api_key" },
    status: "active",
    parameters: [
      { name: "timeoutMs", type: "number", default: 10000, min: 1000, max: 60000, scope: "AgentOverride" },
      { name: "userAgent", type: "string", default: "AgentBot/1.0", scope: "AgentOverride" },
    ],
    argsSchema: {},
    responseSchema: {},
    transport: {
      kind: "http",
      endpoint: "https://fetcher.internal/fetch",
      method: "POST",
      responsePointer: "/content",
      timeoutMsDefault: 15000,
      retry: { maxAttempts: 2, backoff: "fixed", initialDelayMs: 250 },
    },
    approval: { orgApproved: true, riskTier: "medium" },
    quotas: { rateLimitPerMin: 120, burst: 30 },
    lifecycle: { status: "active" },
    metadata: { docsUrl: "https://example.com/docs/web-fetch" },
  },
];

// Admin-curated pinned tool IDs for quick access in the palette (max 5 displayed)
export const PINNED_TOOL_IDS: string[] = [
  "tool-search-policies",
  "tool-web-fetch",
];
