export type ToolParametersRecord = Record<string, unknown>;

export interface AnyToolConfig {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  status?: string;
  auth?: Record<string, unknown>;
  transport?: Record<string, unknown>;
  parameters?: ToolParametersRecord;
  [key: string]: unknown;
}

