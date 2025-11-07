export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
  description?: string;
  default?: unknown;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

export type ToolVariant = {
  id: string; // e.g., "simple", "advanced"
  label: string;
  parameters: JsonSchema; // function arguments schema
  returns?: JsonSchema; // optional shape of result (for docs)
};

export type ToolRuntime = "llm_tool" | "deterministic";

export type ToolDef = {
  id: string; // registry id, unique
  name: string; // human label
  description: string;
  runtime: ToolRuntime;
  tags?: string[];
  version?: string;
  parameters?: JsonSchema; // default schema if no variants
  variants?: ToolVariant[];
  notes?: string;
};

export type ToolRegistry = {
  list(): ToolDef[];
  get(id: string): ToolDef | undefined;
};
