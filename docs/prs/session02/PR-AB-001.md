
# PR‑AB‑001 — IR v0.3: Nodes, Ports, Edges, Transforms (Agent Builder MVP)

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Scope:** Establish a strongly‑typed, spec‑first **IR v0.3** that can express (a) XLSX fan‑out validation and (b) RAG branch fan‑out (SharePoint/OneDrive) with **typed ports**, **edge mappings**, and a minimal **transform/validator** set. Include IR validation + migration scaffolding and tests.  
**Coverage target:** ≥ **80%** for new files (Vitest + RTL, though this PR only adds TS libs + unit tests).

---

## Tenets (apply to this PR)

1. **Spec‑first & Typed**
   - Introduce `IR_VERSION = "0.3"` and a single `GraphDoc` root.
   - Use **discriminated unions** for `NodeKind` and per‑kind config.
   - Co‑publish **JSON Schema** or Zod schemas for runtime validation where user input is persisted/exported.

2. **Codeless by Design**
   - Nodes expose **typed ports** (`InputPort`/`OutputPort`) so the Data Mapper (next PRs) can wire safely.
   - Edge mappings are declarative: `from JSONPath → transforms[] → to port`, with defaults/validators.

3. **Composability**
   - Two Parallel modes (`items` vs `branches`) under one union; reducers are declared on the **target** port or mapping.

4. **Determinism & Observability**
   - Agent nodes will **whitelist** tools by name (registry added in a later PR).
   - IR allows `events` channel names per node (used by Telemetry in later PR).

5. **Quality Bar**
   - Strict TS, no `any`, exhaustive `switch` on discriminants.
   - Unit tests validate IR parsing, migration 0.2→0.3, and example graphs serialize/validate.

---

## File changes

> Paths relative to `src/modules/agent-builder/`

### 1) `model/ir.ts` — **REPLACE** with v0.3 types

```ts
// src/modules/agent-builder/model/ir.ts
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
  | "artifact"        // handle to a blob/file
  | "object"
  | "array"
  | "send_payload";   // internal: payload used by fan-out

export interface JsonSchema {
  // Minimal JSON Schema stub for MVP (extend later as needed)
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: (string | number | boolean)[];
  format?: string;
  description?: string;
  additionalProperties?: boolean | JsonSchema;
  // examples help the Mapper preview
  examples?: any[];
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
  port: string; // name of port
}

export interface TransformToNumber { kind: "to_number"; }
export interface TransformClamp { kind: "clamp"; min?: number; max?: number; }
export interface TransformWrapArray { kind: "wrap_array"; }
export interface TransformPick { kind: "pick"; paths: string[]; }
export interface TransformMerge { kind: "merge"; obj: Record<string, unknown>; }
export interface TransformToString { kind: "to_string"; }
export interface TransformToBoolean { kind: "to_boolean"; }
export interface TransformParseDate { kind: "parse_date"; format?: string; }
export interface TransformRegexReplace { kind: "regex_replace"; pattern: string; replacement: string; flags?: string; }

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

export interface ValidatorRequired { kind: "required"; }
export interface ValidatorMin { kind: "min"; value: number; }
export interface ValidatorMax { kind: "max"; value: number; }
export interface ValidatorRegex { kind: "regex"; pattern: string; flags?: string; }
export interface ValidatorEnum { kind: "enum"; values: (string | number | boolean)[]; }

export type Validator =
  | ValidatorRequired
  | ValidatorMin
  | ValidatorMax
  | ValidatorRegex
  | ValidatorEnum;

export interface EdgeMapping {
  /** JSONPath from the upstream value (e.g., "$.form.values.concurrency") */
  from: string;
  /** Target field or port name on the downstream node (e.g., "concurrency") */
  to: string;
  /** Optional transform pipeline, applied in order */
  transforms?: Transform[];
  /** Default value if source missing/undefined after transforms */
  default?: unknown;
  /** Validators run after transform/default application */
  validators?: Validator[];
  /** Fan-in reducer: MVP supports only list_concat */
  reduce?: "list_concat";
}

export interface Edge {
  id: Id;
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  /** Zero or more mappings; if empty, the engine may pass the entire upstream output */
  mappings: EdgeMapping[];
}

/** ---------- Node Kinds ---------- */
export interface EntryFormNode extends BaseNode {
  kind: "entry.form";
  config?: {
    /** Optional form schema id for UI; free-form values still permitted */
    formSchemaId?: string;
    /** Whether the Entry provides chat messages as well */
    withMessages?: boolean;
  };
  outputs: [
    { name: "messages"; schema: PortSchema },
    { name: "form"; schema: PortSchema },     // { values: object }
    { name: "files"; schema: PortSchema }     // FileRef[] (optional)
  ];
}

export interface AgentNode extends BaseNode {
  kind: "agent";
  config: {
    model?: string;
    /** Allowed deterministic tool names from registry */
    allowedTools?: string[];
    /** Optional structured output schema name or inline schema */
    structuredOutput?: { name?: string; schema?: JsonSchema };
    /** History window policy for branch fan-out */
    historyWindow?: { type: "tokens" | "messages"; max: number };
  };
  inputs?: [
    { name: "messages"; schema: PortSchema; required?: boolean },
    { name: "context"; schema: PortSchema; required?: boolean }
  ];
  outputs?: [
    { name: "text"; schema: PortSchema },
    { name: "output"; schema: PortSchema }    // structured output (if configured)
  ];
}

export interface SequentialNode extends BaseNode {
  kind: "sequential";
  /** Child node ids executed in order */
  config: { children: Id[] };
}

export interface RouterLlmNode extends BaseNode {
  kind: "router.llm";
  config: {
    branches: Id[];               // candidate child node ids
    returnConfidence?: boolean;   // include { confidence } in output
  };
  inputs?: [
    { name: "messages"; schema: PortSchema; required?: boolean },
    { name: "context"; schema: PortSchema; required?: boolean }
  ];
  outputs?: [
    { name: "route"; schema: PortSchema }     // { target: Id, confidence?: number }
  ];
}

export interface ParallelItemsNode extends BaseNode {
  kind: "parallel.items";
  config: {
    concurrency: number;
    workerId: Id;               // target Agent (or Subgraph) to receive each item
    itemPort?: string;          // target port name on worker (default: "row" or "item")
  };
  inputs?: [
    { name: "items"; schema: PortSchema; required: true },
    { name: "concurrency"; schema: PortSchema }
  ];
  outputs?: [
    { name: "results"; schema: PortSchema }   // typically array<X> with reducer
  ];
}

export interface ParallelBranchesNode extends BaseNode {
  kind: "parallel.branches";
  config: {
    children: Id[];             // fixed child node ids to run concurrently
    broadcast?: string[];       // names of fields to broadcast (e.g., ["messages","context"])
    join: "all" | "any" | { timeoutMs: number; policy: "partial" | "fail" };
  };
  inputs?: [
    { name: "messages"; schema: PortSchema },
    { name: "context"; schema: PortSchema }
  ];
  outputs?: [
    { name: "evidence"; schema: PortSchema }  // array<Evidence> with reducer list_concat
  ];
}

export interface ReducerNode extends BaseNode {
  kind: "reducer";
  config?: { strategy?: "list_concat" };
  inputs?: [
    { name: "items"; schema: PortSchema; required: true }
  ];
  outputs?: [
    { name: "results"; schema: PortSchema }
  ];
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
  outputs?: [
    { name: "url"; schema: PortSchema }
  ];
}
```

---

### 2) `model/migrate.ts` — **ADD** v0.2 → v0.3 migration

```ts
// src/modules/agent-builder/model/migrate.ts
import { IR_VERSION, GraphDoc } from "./ir";

export type AnyDoc = { version?: string } & Record<string, any>;

export function migrateToCurrent(doc: AnyDoc): GraphDoc {
  if (doc.version === IR_VERSION) {
    return doc as GraphDoc;
  }
  if (!doc.version || doc.version === "0.2") {
    return migrate02to03(doc as any);
  }
  throw new Error(`Unsupported IR version: ${doc.version ?? "∅"}`);
}

function migrate02to03(doc02: any): GraphDoc {
  // Shallow copy
  const cloned = JSON.parse(JSON.stringify(doc02));
  // Example: collapse entry.file into entry.form
  for (const n of cloned.nodes ?? []) {
    if (n.kind === "entry.file") {
      n.kind = "entry.form";
      n.config = { ...(n.config ?? {}), withMessages: true };
    }
  }
  // Bump version
  cloned.version = IR_VERSION;
  // Ensure required root fields
  cloned.id ||= cloned.id ?? "graph_" + Math.random().toString(36).slice(2);
  cloned.name ||= cloned.name ?? "Untitled";
  cloned.meta ||= {};
  cloned.edges ||= [];
  cloned.nodes ||= [];
  return cloned as GraphDoc;
}
```

---

### 3) `model/validate.ts` — **ADD** Zod runtime validation

```ts
// src/modules/agent-builder/model/validate.ts
import { z } from "zod";
import { IR_VERSION, GraphDoc } from "./ir";

const jsonSchemaZ = z.object({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  properties: z.record(z.lazy(() => jsonSchemaZ)).optional(),
  items: z.lazy(() => jsonSchemaZ).optional(),
  required: z.array(z.string()).optional(),
  enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  format: z.string().optional(),
  description: z.string().optional(),
  additionalProperties: z.union([z.boolean(), z.lazy(() => jsonSchemaZ)]).optional(),
  examples: z.array(z.any()).optional()
});

const portSchemaZ = z.object({
  type: z.enum(["string","number","boolean","datetime","artifact","object","array","send_payload"]),
  jsonSchema: jsonSchemaZ.optional(),
  reducer: z.enum(["list_concat"]).optional(),
  example: z.any().optional()
});

const inputPortZ = z.object({
  name: z.string().min(1),
  schema: portSchemaZ,
  required: z.boolean().optional()
});

const outputPortZ = z.object({
  name: z.string().min(1),
  schema: portSchemaZ
});

const idZ = z.string().min(1);

const baseNodeZ = z.object({
  id: idZ,
  kind: z.enum([
    "entry.form","agent","sequential","router.llm",
    "parallel.items","parallel.branches","reducer","publisher"
  ]),
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
  inputs: z.array(inputPortZ).optional(),
  outputs: z.array(outputPortZ).optional()
});

export const graphDocZ = z.object({
  version: z.literal(IR_VERSION),
  id: idZ,
  name: z.string().min(1),
  meta: z.record(z.any()).optional(),
  nodes: z.array(baseNodeZ).min(1),
  edges: z.array(z.object({
    id: idZ,
    from: z.object({ nodeId: idZ, port: z.string().min(1) }),
    to: z.object({ nodeId: idZ, port: z.string().min(1) }),
    mappings: z.array(z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      transforms: z.array(z.object({
        kind: z.enum([
          "to_number","clamp","wrap_array","pick","merge",
          "to_string","to_boolean","parse_date","regex_replace"
        ]),
        min: z.number().optional(),
        max: z.number().optional(),
        paths: z.array(z.string()).optional(),
        obj: z.record(z.any()).optional(),
        format: z.string().optional(),
        pattern: z.string().optional(),
        replacement: z.string().optional(),
        flags: z.string().optional()
      })).optional(),
      default: z.any().optional(),
      validators: z.array(z.object({
        kind: z.enum(["required","min","max","regex","enum"]),
        value: z.number().optional(),
        pattern: z.string().optional(),
        flags: z.string().optional(),
        values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional()
      })).optional(),
      reduce: z.enum(["list_concat"]).optional()
    })).optional()
  })).optional()
}) satisfies z.ZodType<GraphDoc>;

export function validateGraphDoc(doc: unknown) {
  return graphDocZ.safeParse(doc);
}
```

---

### 4) Tests — **ADD**

```
src/modules/agent-builder/model/__tests__/ir.spec.ts
src/modules/agent-builder/model/__tests__/migrate.spec.ts
src/modules/agent-builder/model/__tests__/validate.spec.ts
```

**`ir.spec.ts`**
```ts
import { describe, it, expect } from "vitest";
import { IR_VERSION, GraphDoc } from "../ir";

describe("IR v0.3", () => {
  it("exports a version constant", () => {
    expect(IR_VERSION).toBeTypeOf("string");
    expect(IR_VERSION).toBe("0.3");
  });

  it("accepts a minimal valid GraphDoc shape (compile-time)", () => {
    const doc: GraphDoc = {
      version: "0.3",
      id: "g1",
      name: "Demo",
      nodes: [{
        id: "n1",
        kind: "entry.form",
        outputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "form",     schema: { type: "object" } },
          { name: "files",    schema: { type: "array" } }
        ]
      }],
      edges: []
    };
    expect(doc.name).toBe("Demo");
  });
});
```

**`migrate.spec.ts`**
```ts
import { describe, it, expect } from "vitest";
import { migrateToCurrent } from "../migrate";
import { IR_VERSION } from "../ir";

describe("migrate v0.2 → v0.3", () => {
  it("bumps version and converts entry.file → entry.form", () => {
    const legacy = {
      version: "0.2",
      id: "g2",
      name: "Legacy",
      nodes: [{ id: "nf", kind: "entry.file" }],
      edges: []
    };
    const next = migrateToCurrent(legacy);
    expect(next.version).toBe(IR_VERSION);
    const kinds = next.nodes.map((n: any) => n.kind);
    expect(kinds).toContain("entry.form");
  });
});
```

**`validate.spec.ts`**
```ts
import { describe, it, expect } from "vitest";
import { validateGraphDoc } from "../validate";
import { IR_VERSION } from "../ir";

describe("graphDocZ", () => {
  it("validates a minimal graph", () => {
    const doc = {
      version: IR_VERSION,
      id: "g1",
      name: "Minimal",
      nodes: [{
        id: "n1",
        kind: "entry.form",
        outputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "form", schema: { type: "object" } },
          { name: "files", schema: { type: "array" } }
        ]
      }],
      edges: []
    };
    const res = validateGraphDoc(doc);
    expect(res.success).toBe(true);
  });

  it("rejects bad edge mapping", () => {
    const doc = {
      version: IR_VERSION,
      id: "g1",
      name: "BadMap",
      nodes: [
        { id: "a", kind: "entry.form", outputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "form", schema: { type: "object" } },
          { name: "files", schema: { type: "array" } }
        ]},
        { id: "b", kind: "agent" }
      ],
      edges: [{
        id: "e1",
        from: { nodeId: "a", port: "form" },
        to: { nodeId: "b", port: "messages" },
        mappings: [{ from: "", to: "" }]   // invalid
      }]
    };
    const res = validateGraphDoc(doc);
    expect(res.success).toBe(false);
  });
});
```

---

## Package updates (if not already present)

```jsonc
// package.json (additions)
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "zod": "^3.23.8"
  },
  "scripts": {
    "test": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

---

## Examples (golden IR sketches for later PRs)

- **XLSX fan‑out** and **RAG SP/OD branches** examples included above; import them as golden fixtures when needed.

---

## Acceptance Criteria

- `ir.ts` compiles; `IR_VERSION === "0.3"`; all node kinds/types exported.
- `migrate.ts` converts a basic `0.2` doc with `entry.file` → `entry.form` and bumps version.
- `validate.ts` validates minimal and rejects malformed graphs.
- Vitest coverage for `model/*` files ≥ **80%**.

---

## How to Review

```bash
pnpm i        # or npm i / yarn
pnpm test     # vitest run --coverage
```

---

## Notes / Future PR Hooks

- Node‑kind‑specific validation will be layered in PR‑AB‑003/005/006.
- Tool registry + schemas land in PR‑AB‑007.
- Exporter/Telemetry consume this IR in PR‑AB‑008/009.
