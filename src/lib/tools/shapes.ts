export type Visibility = "Normal" | "LLMHidden" | "AgentOverride";

export type ArgSchema =
  | { kind: "string"; name: string; label?: string; placeholder?: string; visibility?: Visibility; enum?: string[]; multiline?: boolean; required?: boolean }
  | { kind: "string[]"; name: string; label?: string; placeholder?: string; visibility?: Visibility }
  | { kind: "number"; name: string; label?: string; min?: number; max?: number; step?: number; visibility?: Visibility; required?: boolean }
  | { kind: "boolean"; name: string; label?: string; visibility?: Visibility }
  | { kind: "object"; name: string; label?: string; properties: ArgSchema[]; visibility?: Visibility }
  ;

export type ToolMeta = {
  toolId: string;               // e.g., "tool:ddgs.search"
  name: string;
  version?: string;
  summary?: string;
  argsSchema: ArgSchema[];
  defaults?: Record<string, any>;
};

export type ToolOverrideValue = {
  value: any;
  visibility: Visibility;
};

export type ToolOverrides = Record<string, ToolOverrideValue>; // keyed by arg name

// View model for inspector combining toolId and overrides
export type AgentToolBinding = {
  toolNodeId: string;
  toolId: string;
  overrides: ToolOverrides;
};
