export type ToolParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "array<string>" | "array<number>";
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
  version: string;
  category?: string;
  auth?: { type?: string; scopes?: string[] };
  transport?: { kind: string; endpoint?: string; toolId?: string; [key: string]: any };
  parameters?: ToolParameter[];
  status?: "active" | "deprecated" | "retired" | string;
  description?: string;
  metadata?: { docsUrl?: string };
  argsSchema?: Record<string, any>;
  responseSchema?: Record<string, any>;
};

export type ToolsListQuery = {
  search?: string;
  category?: string;
  owner?: string;
  authType?: string;
  transport?: string;
  status?: string;
  cursor?: string;
  limit?: number;
};

export interface ToolsClient {
  listTools(query?: ToolsListQuery): Promise<{ items: ToolDefinition[]; nextCursor?: string }>;
  getTool(id: string): Promise<ToolDefinition | undefined>;
  listPinnedTools?(): Promise<ToolDefinition[]>;
  validateConnection?(toolId: string): Promise<{ ok: boolean; error?: string }>;
  listSecrets?(): Promise<string[]>;
}
