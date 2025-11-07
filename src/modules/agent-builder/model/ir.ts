/* eslint-disable @typescript-eslint/consistent-type-definitions */

export const IR_VERSION = "0.3" as const;

export type Id = string;

/** ---------- Core Graph ---------- */
export interface GraphDoc {
  version: typeof IR_VERSION;
  id: Id;
  name: string;
  meta?: Record<string, unknown>;
  nodes: NodeAny[];
  edges: Edge[];
}

export type NodeKind =
  | "entry.form"
  | "agent"
  | "sequential"
  | "router.llm"
  | "parallel.items"
  | "parallel.branches"
  | "reducer"
  | "publisher";

export type NodeAny =
  | EntryFormNode
  | AgentNode
  | SequentialNode
  | RouterLlmNode
  | ParallelItemsNode
  | ParallelBranchesNode
  | ReducerNode
  | PublisherNode;

export interface BaseNode {
  id: Id;
  kind: NodeKind;
  name?: string;
  description?: string;
  /** Arbitrary tags for UI/search */
  tags?: string[];
  /** Node-level metadata for telemetry or engine adapters */
  meta?: Record<string, unknown>;
  /** Ports are declared so the Data Mapper can validate connections */
  inputs?: InputPort[];
  outputs?: OutputPort[];
}

/** ---------- Port Schemas ---------- */
export type BasicType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "artifact"
  | "object"
  | "array"
  | "send_payload";

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: (string | number | boolean)[];
  format?: string;
  description?: string;
  additionalProperties?: boolean | JsonSchema;
  examples?: unknown[];
}

export interface PortSchema {
  /** Basic shape for quick checks */
  type: BasicType;
  /** Optional JSON Schema for richer validation */
  jsonSchema?: JsonSchema;
  /** Optional reducer hint for fan-in targets (MVP: list_concat) */
  reducer?: "list_concat";
  /** Example value shown in UI previews */
  example?: unknown;
}

export interface InputPort {
  name: string;
  schema: PortSchema;
  required?: boolean;
}

export interface OutputPort {
  name: string;
  schema: PortSchema;
}

/** ---------- Edge & Mapping ---------- */
export interface EdgeEndpoint {
  nodeId: Id;
  port: string;
}

export interface TransformToNumber {
  kind: "to_number";
}

export interface TransformClamp {
  kind: "clamp";
  min?: number;
  max?: number;
}

export interface TransformWrapArray {
  kind: "wrap_array";
}

export interface TransformPick {
  kind: "pick";
  paths: string[];
}

export interface TransformMerge {
  kind: "merge";
  obj: Record<string, unknown>;
}

export interface TransformToString {
  kind: "to_string";
}

export interface TransformToBoolean {
  kind: "to_boolean";
}

export interface TransformParseDate {
  kind: "parse_date";
  format?: string;
}

export interface TransformRegexReplace {
  kind: "regex_replace";
  pattern: string;
  replacement: string;
  flags?: string;
}

export type Transform =
  | TransformToNumber
  | TransformClamp
  | TransformWrapArray
  | TransformPick
  | TransformMerge
  | TransformToString
  | TransformToBoolean
  | TransformParseDate
  | TransformRegexReplace;

export interface ValidatorRequired {
  kind: "required";
}

export interface ValidatorMin {
  kind: "min";
  value: number;
}

export interface ValidatorMax {
  kind: "max";
  value: number;
}

export interface ValidatorRegex {
  kind: "regex";
  pattern: string;
  flags?: string;
}

export interface ValidatorEnum {
  kind: "enum";
  values: (string | number | boolean)[];
}

export type Validator =
  | ValidatorRequired
  | ValidatorMin
  | ValidatorMax
  | ValidatorRegex
  | ValidatorEnum;

export interface EdgeMapping {
  from: string;
  to: string;
  transforms?: Transform[];
  default?: unknown;
  validators?: Validator[];
  reduce?: "list_concat";
}

export interface Edge {
  id: Id;
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  mappings: EdgeMapping[];
}

/** ---------- Node Kinds ---------- */
export interface EntryFormNode extends BaseNode {
  kind: "entry.form";
  config?: {
    formSchemaId?: string;
    withMessages?: boolean;
  };
  outputs: [
    { name: "messages"; schema: PortSchema },
    { name: "form"; schema: PortSchema },
    { name: "files"; schema: PortSchema }
  ];
}

export type ToolRef = { toolId: string; variantId?: string };

export interface AgentNode extends BaseNode {
  kind: "agent";
  config: {
    model?: string;
    allowedTools?: ToolRef[];
    structuredOutput?: { name?: string; schema?: JsonSchema };
    historyWindow?: { type: "tokens" | "messages"; max: number };
  };
  inputs?: [
    { name: "messages"; schema: PortSchema; required?: boolean },
    { name: "context"; schema: PortSchema; required?: boolean }
  ];
  outputs?: [
    { name: "text"; schema: PortSchema },
    { name: "output"; schema: PortSchema }
  ];
}

export interface SequentialNode extends BaseNode {
  kind: "sequential";
  config: { children: Id[] };
}

export interface RouterLlmNode extends BaseNode {
  kind: "router.llm";
  config: {
    branches: Id[];
    returnConfidence?: boolean;
  };
  inputs?: [
    { name: "messages"; schema: PortSchema; required?: boolean },
    { name: "context"; schema: PortSchema; required?: boolean }
  ];
  outputs?: [{ name: "route"; schema: PortSchema }];
}

export interface ParallelItemsNode extends BaseNode {
  kind: "parallel.items";
  config: {
    concurrency: number;
    workerId: Id;
    itemPort?: string;
  };
  inputs?: [
    { name: "items"; schema: PortSchema; required: true },
    { name: "concurrency"; schema: PortSchema }
  ];
  outputs?: [{ name: "results"; schema: PortSchema }];
}

export interface ParallelBranchesNode extends BaseNode {
  kind: "parallel.branches";
  config: {
    children: Id[];
    broadcast?: string[];
    join: "all" | "any" | { timeoutMs: number; policy: "partial" | "fail" };
  };
  inputs?: [
    { name: "messages"; schema: PortSchema },
    { name: "context"; schema: PortSchema }
  ];
  outputs?: [{ name: "evidence"; schema: PortSchema }];
}

export interface ReducerNode extends BaseNode {
  kind: "reducer";
  config?: { strategy?: "list_concat" };
  inputs?: [{ name: "items"; schema: PortSchema; required: true }];
  outputs?: [{ name: "results"; schema: PortSchema }];
}

export interface PublisherNode extends BaseNode {
  kind: "publisher";
  config?: {
    destination?: "sharepoint" | "webhook" | "s3";
    path?: string;
  };
  inputs?: [
    { name: "artifact"; schema: PortSchema; required: true },
    { name: "metadata"; schema: PortSchema }
  ];
  outputs?: [{ name: "url"; schema: PortSchema }];
}
