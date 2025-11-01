export type McpAuthType = "OBO" | "client_credentials" | "api_key" | "mtls";

export type McpAuthConfig = {
  type: McpAuthType;
  scopes?: string[];
  secretRef?: string | null;   // *reference* only; no secrets stored in FE
  // Additional fields may exist; mirror IR loosely to avoid fragility.
  [k: string]: any;
};

export type McpCapabilities = {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  sampling?: boolean;
};

export type McpServerData = {
  url: string;
  protocol: string;             // e.g., "mcp/1.0"
  auth?: McpAuthConfig;
  capabilities?: McpCapabilities;
  namespaceFilter?: string[];
  metadata?: Record<string, any>;
};

export type McpServerNode = {
  id: string;
  kind: "mcpServer";
  label: string;
  data: McpServerData;
};

export type Graph = { nodes: any[]; edges: any[] };
