
# PR‑AB‑008 — Exporter: OpenAI‑style Tool Specs + Runnable Engine Request Envelope

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001..007 (IR, Palette/Canvas, Mapper, Parallel Items/Branches, Combiner, Tool Registry)  
**Scope:** Implement an **Exporter** that turns the in‑memory IR v0.3 graph into:
1) An **OpenAI‑style tool list** (`[{ type: "function", function: { name, description, parameters } }]`) generated from the **Tool Registry** + Agent selections.  
2) A **runnable engine request envelope** that the gateway/API can POST to the Orchestration Engine’s `/v1/execute` or `/v1/execute/stream` endpoints.

**Coverage target:** **≥80%** (Vitest + RTL).

---

## Tenets

1. **Spec‑first** — Tool specs match OpenAI “function” tool shape. The envelope uses a clear, versioned schema with `sse.format = "openai.responses"`.
2. **Deterministic & Minimal** — The exporter **does not execute** mappings; it serializes nodes, edges, and mappings as declarative data.
3. **Composable** — EngineGraph is a normalized structure (stable ids, nodes, edges) that server‑side compilers can consume.
4. **Validation‑lite** — Fast checks: missing workerId, dangling node ids, unknown ports, or edges without mappings → warnings array.
5. **Quality** — Pure functions for graph traversal and tool extraction; UI preview panel with download button.

---

## File changes (under `src/modules/agent-builder`)

### 1) **NEW** `exporter/types.ts` — normalized engine graph

```ts
// src/modules/agent-builder/exporter/types.ts
import type { GraphDoc, Edge, NodeAny, Id } from "../model/ir";

export type EngineNode = {
  id: Id;
  kind: NodeAny["kind"];
  config?: Record<string, unknown>;
  // Ports are useful for downstream validators/engines
  inputs?: NodeAny["inputs"];
  outputs?: NodeAny["outputs"];
  meta?: Record<string, unknown>;
};

export type EngineGraph = {
  version: "eng-0.1";
  id: Id;
  name: string;
  nodes: Record<Id, EngineNode>;
  edges: Edge[]; // Edge carries mappings (from PR‑AB‑004)
  entry?: Id;    // optional: designates the entry node (usually entry.form)
  warnings?: string[];
};
```

---

### 2) **NEW** `exporter/extract_tools.ts` — OpenAI tool specs from registry

```ts
// src/modules/agent-builder/exporter/extract_tools.ts
import type { GraphDoc, NodeAny } from "../model/ir";
import type { ToolRegistry, ToolDef } from "../model/tools";

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: any; // JSON Schema
  };
};

function toOpenAiTool(def: ToolDef, variantId?: string | null): OpenAiTool {
  const variant = (def.variants ?? []).find(v => v.id === variantId ?? undefined);
  const schema = variant?.parameters ?? def.parameters ?? { type: "object" };
  // OpenAI requires function name to be [a-z0-9_-]{1,64}; sanitize id
  const name = def.id.replace(/[^a-z0-9_\-]/gi, "_").slice(0, 64);
  return {
    type: "function",
    function: {
      name,
      description: def.description,
      parameters: schema
    }
  };
}

export function extractOpenAiTools(doc: GraphDoc, registry: ToolRegistry): OpenAiTool[] {
  const set = new Map<string, OpenAiTool>();
  for (const n of doc.nodes) {
    if (n.kind !== "agent") continue;
    const allowed = (n as any).config?.allowedTools ?? [];
    for (const ref of allowed) {
      const def = registry.get(ref.toolId);
      if (!def) continue;
      const key = `${def.id}:${ref.variantId ?? ""}`;
      if (!set.has(key)) {
        set.set(key, toOpenAiTool(def, ref.variantId));
      }
    }
  }
  return Array.from(set.values());
}
```

---

### 3) **NEW** `exporter/compile.ts` — IR → EngineGraph

```ts
// src/modules/agent-builder/exporter/compile.ts
import type { GraphDoc, NodeAny, Id } from "../model/ir";
import type { EngineGraph, EngineNode } from "./types";

export type CompileWarnings = string[];

function indexNodes(doc: GraphDoc): Record<Id, EngineNode> {
  const map: Record<Id, EngineNode> = {};
  for (const n of doc.nodes) {
    map[n.id] = {
      id: n.id,
      kind: n.kind,
      config: (n as any).config ?? {},
      inputs: n.inputs,
      outputs: n.outputs,
      meta: n.meta ?? {},
    };
  }
  return map;
}

function findEntry(doc: GraphDoc): Id | undefined {
  // Prefer a single entry.form; else undefined
  const e = doc.nodes.find(n => n.kind === "entry.form");
  return e?.id;
}

export function compileGraph(doc: GraphDoc): { graph: EngineGraph; warnings: CompileWarnings } {
  const warnings: CompileWarnings = [];
  const nodes = indexNodes(doc);

  // Validate edges: node id exists, port names sane
  for (const e of doc.edges) {
    const from = nodes[e.from.nodeId];
    const to = nodes[e.to.nodeId];
    if (!from) warnings.push(`edge(${e.id}): missing from.nodeId=${e.from.nodeId}`);
    if (!to) warnings.push(`edge(${e.id}): missing to.nodeId=${e.to.nodeId}`);
    if (from) {
      const outPorts = (from.outputs ?? []).map(p => p.name);
      if (!outPorts.includes(e.from.port)) warnings.push(`edge(${e.id}): from.port '${e.from.port}' not found on node ${from.id}`);
    }
    if (to) {
      const inPorts = (to.inputs ?? []).map(p => p.name);
      if (!inPorts.includes(e.to.port)) warnings.push(`edge(${e.id}): to.port '${e.to.port}' not found on node ${to.id}`);
    }
  }

  // Parallel.items worker sanity
  for (const n of Object.values(nodes)) {
    if (n.kind === "parallel.items") {
      const wid = (n.config as any)?.workerId;
      if (!wid || !nodes[wid]) warnings.push(`parallel.items(${n.id}): workerId missing or not found: '${wid}'`);
    }
  }

  const graph: EngineGraph = {
    version: "eng-0.1",
    id: doc.id,
    name: doc.name,
    nodes,
    edges: doc.edges.slice(),
    entry: findEntry(doc),
    warnings: warnings.length ? warnings : undefined,
  };
  return { graph, warnings };
}
```

---

### 4) **NEW** `exporter/request_envelope.ts` — build execute request

```ts
// src/modules/agent-builder/exporter/request_envelope.ts
import type { GraphDoc } from "../model/ir";
import type { ToolRegistry } from "../model/tools";
import { compileGraph } from "./compile";
import { extractOpenAiTools, type OpenAiTool } from "./extract_tools";

export type EntryInput = {
  // Mirrors Entry (Chat/Form) outputs; any fields may be present.
  messages?: Array<{ role: "user" | "system" | "assistant" | "tool"; content: any }>;
  form?: Record<string, unknown>;
  files?: Array<{ file_id: string; name?: string; mime_type?: string }>;
};

export type ExecuteEnvelope = {
  api: { version: "v1"; sse: { format: "openai.responses" } };
  orchestration: ReturnType<typeof compileGraph>["graph"];
  tools: OpenAiTool[];
  input: EntryInput;
  // Optional: tenant/correlation headers are set at transport layer by the gateway
};

export function buildExecuteEnvelope(doc: GraphDoc, registry: ToolRegistry, input: EntryInput): ExecuteEnvelope {
  const { graph } = compileGraph(doc);
  const tools = extractOpenAiTools(doc, registry);
  return {
    api: { version: "v1", sse: { format: "openai.responses" } },
    orchestration: graph,
    tools,
    input
  };
}
```

---

### 5) **NEW** `components/Exporter/ExporterPanel.tsx` — preview & download

```tsx
// src/modules/agent-builder/components/Exporter/ExporterPanel.tsx
import React, { useMemo, useState } from "react";
import type { GraphDoc } from "../../model/ir";
import { DefaultToolRegistry } from "../../registry/tools.default";
import { buildExecuteEnvelope, type ExecuteEnvelope } from "../../exporter/request_envelope";

type Props = {
  doc: GraphDoc;
  sampleInput?: any; // provide a sample Entry payload if available
};

function downloadJson(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const ExporterPanel: React.FC<Props> = ({ doc, sampleInput }) => {
  const [tab, setTab] = useState<"envelope" | "tools" | "warnings">("envelope");
  const env = useMemo<ExecuteEnvelope>(() => buildExecuteEnvelope(doc, DefaultToolRegistry, sampleInput ?? {}), [doc, sampleInput]);
  const tools = env.tools;
  const warnings = env.orchestration.warnings ?? [];

  return (
    <section className="ab-exporter">
      <header className="ab-exporter-header">
        <strong>Exporter</strong>
        <div className="ab-tabs">
          <button className={`ab-tab ${tab==="envelope"?"is-active":""}`} onClick={() => setTab("envelope")}>Envelope</button>
          <button className={`ab-tab ${tab==="tools"?"is-active":""}`} onClick={() => setTab("tools")}>Tools</button>
          <button className={`ab-tab ${tab==="warnings"?"is-active":""}`} onClick={() => setTab("warnings")}>Warnings {warnings.length ? `(${warnings.length})` : ""}</button>
        </div>
        <div className="ab-actions">
          <button className="ab-btn ab-btn-primary" onClick={() => downloadJson(env, `${doc.name || "orchestration"}.execute.json`)}>Download JSON</button>
        </div>
      </header>

      <div className="ab-exporter-body">
        {tab === "envelope" && <pre className="ab-pre">{JSON.stringify(env, null, 2)}</pre>}
        {tab === "tools" && <pre className="ab-pre">{JSON.stringify(tools, null, 2)}</pre>}
        {tab === "warnings" && (
          warnings.length ? <ul className="ab-list">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <div>No warnings</div>
        )}
      </div>
    </section>
  );
};
```

**Styles (append to builder CSS):**
```css
.ab-exporter { border: 1px solid var(--line); border-radius: 12px; background: var(--card); display: grid; }
.ab-exporter-header { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.ab-tabs { margin-left: auto; display: flex; gap: 6px; }
.ab-tab { padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--chip); cursor: pointer; }
.ab-tab.is-active { outline: 2px solid var(--brand); }
.ab-actions { display: flex; gap: 8px; }
.ab-exporter-body { padding: 8px 12px; max-height: 420px; overflow: auto; }
.ab-list { margin: 0; padding-left: 18px; }
```

---

### 6) **NEW** tests

```
src/modules/agent-builder/exporter/__tests__/extract_tools.spec.ts
src/modules/agent-builder/exporter/__tests__/compile.spec.ts
src/modules/agent-builder/exporter/__tests__/request_envelope.spec.ts
src/modules/agent-builder/components/Exporter/__tests__/ExporterPanel.spec.tsx
```

**`extract_tools.spec.ts`** — unique OpenAI tool list

```ts
import { describe, it, expect } from "vitest";
import { extractOpenAiTools } from "../../extract_tools";

const registry = {
  list: () => [],
  get: (id: string) => ({
    id,
    name: id,
    description: "desc",
    runtime: "llm_tool",
    parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] }
  } as any)
} as any;

describe("extractOpenAiTools", () => {
  it("collects unique tools from agent selections", () => {
    const doc: any = {
      nodes: [
        { id: "a", kind: "agent", config: { allowedTools: [{ toolId: "web.search" }] } },
        { id: "b", kind: "agent", config: { allowedTools: [{ toolId: "web.search" }, { toolId: "news.search", variantId: "default" }] } }
      ],
      edges: [], id: "g", name: "t"
    };
    const out = extractOpenAiTools(doc, registry);
    expect(out.length).toBe(2);
    expect(out[0].type).toBe("function");
  });
});
```

**`compile.spec.ts`** — warnings & shape

```ts
import { describe, it, expect } from "vitest";
import { compileGraph } from "../../compile";

describe("compileGraph", () => {
  it("indexes nodes and validates edges", () => {
    const doc: any = {
      id: "g1",
      name: "T",
      nodes: [
        { id: "entry", kind: "entry.form", outputs: [{ name: "messages", schema: { type: "array" } }] },
        { id: "agent", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }] }
      ],
      edges: [{ id: "e1", from: { nodeId: "entry", port: "messages" }, to: { nodeId: "agent", port: "messages" }, mappings: [] }]
    };
    const { graph, warnings } = compileGraph(doc as any);
    expect(graph.nodes["entry"].kind).toBe("entry.form");
    expect(graph.edges).toHaveLength(1);
    expect(warnings.length).toBe(0);
  });

  it("warns on bad ports", () => {
    const doc: any = {
      id: "g2",
      name: "T",
      nodes: [{ id: "a", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }] }],
      edges: [{ id: "e", from: { nodeId: "a", port: "nope" }, to: { nodeId: "a", port: "messages" }, mappings: [] }]
    };
    const { warnings } = compileGraph(doc as any);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
```

**`request_envelope.spec.ts`** — envelope shape & sse flag

```ts
import { describe, it, expect } from "vitest";
import { buildExecuteEnvelope } from "../../request_envelope";

const registry = {
  list: () => [],
  get: (_: string) => undefined
} as any;

describe("buildExecuteEnvelope", () => {
  it("builds an envelope with tools and graph", () => {
    const doc: any = { id: "g", name: "t", nodes: [], edges: [] };
    const env = buildExecuteEnvelope(doc, registry, { messages: [{ role: "user", content: "hi" }] });
    expect(env.api.sse.format).toBe("openai.responses");
    expect(env.orchestration.version).toBe("eng-0.1");
    expect(env.tools).toEqual([]);
  });
});
```

**`ExporterPanel.spec.tsx`** — renders and downloads

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExporterPanel } from "../../ExporterPanel";

describe("ExporterPanel", () => {
  it("renders and shows Envelope tab", () => {
    const doc: any = { id: "g", name: "t", nodes: [], edges: [] };
    render(<ExporterPanel doc={doc} />);
    expect(screen.getByText(/Exporter/)).toBeTruthy();
    expect(screen.getByText(/Envelope/)).toBeTruthy();
  });
});
```

---

## Envelope Example (what the UI will show)

```jsonc
{
  "api": { "version": "v1", "sse": { "format": "openai.responses" } },
  "orchestration": {
    "version": "eng-0.1",
    "id": "g_abc123",
    "name": "Data Validation",
    "entry": "n_entry",
    "nodes": {
      "n_entry": { "id": "n_entry", "kind": "entry.form", "outputs": [ { "name":"messages","schema":{"type":"array"} }, { "name":"form","schema":{"type":"object"} }, { "name":"files","schema":{"type":"array"} } ] },
      "n_parallel": { "id": "n_parallel", "kind": "parallel.items", "config": { "concurrency": 16, "workerId": "n_worker" } },
      "n_worker": { "id": "n_worker", "kind": "agent", "config": { "model": "gpt-4.1", "allowedTools": [ { "toolId":"s3.get_object" } ] } },
      "n_combine": { "id": "n_combine", "kind": "agent", "meta": { "combiner": true }, "inputs": [ { "name":"evidence","schema":{"type":"array"} } ] }
    },
    "edges": [
      { "id": "e1", "from": { "nodeId":"n_entry","port":"form" }, "to": { "nodeId":"n_parallel","port":"items" }, "mappings":[ { "from":"$.form.rows[*]", "to":"items", "reduce":"list_concat" } ] },
      { "id": "e2", "from": { "nodeId":"n_parallel","port":"results" }, "to": { "nodeId":"n_combine","port":"evidence" }, "mappings":[ { "from":"$", "to":"evidence", "reduce":"list_concat" } ] }
    ]
  },
  "tools": [
    { "type": "function", "function": { "name": "s3_get_object", "description": "Fetch an object from S3, returning an artifact reference.", "parameters": { "type":"object", "properties": { "bucket":{"type":"string"}, "key":{"type":"string"} }, "required":["bucket","key"] } } }
  ],
  "input": {
    "messages": [ { "role":"user", "content":[{ "type":"input_text", "text":"Validate this file" }] } ],
    "form": { "concurrency": 16 },
    "files": [ { "file_id": "file_abc123", "name": "rows.xlsx", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } ]
  }
}
```

> The **server** is responsible for executing the graph, applying mappings at run time, and emitting **OpenAI Responses‑style SSE** (e.g., `response.tool_call.delta`, `response.tool_result.done`, `response.output_text.delta`, `response.completed`).

---

## Acceptance Criteria

- `extract_tools.ts` produces a **deduplicated** OpenAI tool list from Agent selections + registry resolver.
- `compile.ts` returns a normalized **EngineGraph** with warnings for missing ports/ids/workerId.
- `request_envelope.ts` builds an **ExecuteEnvelope** including `api.sse.format = "openai.responses"`.
- `ExporterPanel` previews the envelope, tools, and warnings; allows **download** as JSON.
- Unit tests cover the above with **≥80%** coverage for new files.

---

## How to Review & Test

```bash
pnpm i
pnpm test

# In the builder UI:
# - Build a small graph with entry.form → agent (with tools) → combiner.
# - Open Exporter panel to preview the envelope and tools.
# - Download JSON and inspect; ensure node ids, edges, and mappings present.
```

---

## Notes / Next

- **PR‑AB‑009:** Preview runner with mock tool results and simulated SSE to validate orchestration UX before hooking real engine.
- **PR‑AB‑010:** Remote Tool Registries (MCP servers), caching, and per‑tenant capabilities.
