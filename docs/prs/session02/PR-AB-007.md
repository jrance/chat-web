
# PR‑AB‑007 — Tool Registry + Per‑Tool Schema Picker (Agent Nodes)

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001/002/003/004/005/006  
**Scope:** Introduce a **Tool Registry** (typed, local for MVP) and an **Agent Tools Picker** that lets users choose which tools an Agent can call, including picking a **parameter schema variant** per tool (e.g., “simple” vs “advanced”). Show schema details, examples, and persist selections into IR v0.3 (`AgentNode.config.allowedTools`).  
**Coverage target:** **≥80%** (Vitest + React Testing Library).

---

## Tenets

1. **Spec‑first & Typed**
   - Tools follow an **OpenAI function‑tool style**: `name`, `description`, and a **JSON Schema** for `parameters`.  
   - Agent nodes store **tool references** as `{ toolId, variantId? }` only; no copies of the full schema in the node.

2. **Codeless by Design**
   - Users pick tools and (if available) a **variant** from the registry; no code.  
   - Tool schemas are *visible* (collapsible viewer), with **example payloads** for quick understanding.

3. **Determinism & Interop**
   - Registry is local (static) for MVP but shaped to swap in **remote catalogs** later (MCP/tool servers).  
   - JSON Schema subset is sufficient for OpenAI tools; we avoid custom schema flavors.

4. **Quality**
   - Pure helpers for registry lookups and schema example generation.  
   - Tests for picker behavior, persistence, and schema rendering.

---

## IR Notes (no breaking changes)

Ensure `AgentNode.config.allowedTools` is an array of simple references:

```ts
// src/modules/agent-builder/model/ir.ts (already introduced earlier)
export type ToolRef = { toolId: string; variantId?: string };

export type AgentNode = NodeBase & {
  kind: "agent";
  config: {
    model?: string;
    allowedTools: ToolRef[]; // <-- used by Tools Picker
  };
  inputs?: Port[];
  outputs?: Port[];
  meta?: Record<string, unknown>;
};
```

If `ToolRef` doesn’t exist yet from PR‑AB‑001, add it as shown.

---

## Files (all under `src/modules/agent-builder`)

### 1) **NEW** `model/tools.ts` — typed tool definitions

```ts
// src/modules/agent-builder/model/tools.ts
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
  id: string;                 // e.g., "simple", "advanced"
  label: string;
  parameters: JsonSchema;     // function arguments schema
  returns?: JsonSchema;       // optional shape of result (for docs)
};

export type ToolRuntime = "llm_tool" | "deterministic";

export type ToolDef = {
  id: string;                 // registry id, unique
  name: string;               // human label
  description: string;
  runtime: ToolRuntime;
  tags?: string[];
  version?: string;
  // Default parameters if tool has a single schema; if variants provided, picker uses those instead.
  parameters?: JsonSchema;
  variants?: ToolVariant[];
  // Optional safety/limits info for docs
  notes?: string;
};

export type ToolRegistry = {
  list(): ToolDef[];
  get(id: string): ToolDef | undefined;
};
```

---

### 2) **NEW** `registry/tools.default.ts` — built‑in tools (MVP)

```ts
// src/modules/agent-builder/registry/tools.default.ts
import type { ToolRegistry, ToolDef } from "../model/tools";

const TOOLS: ToolDef[] = [
  {
    id: "web.search",
    name: "Web Search",
    description: "General web search (serp adapter). Returns ranked web results.",
    runtime: "llm_tool",
    tags: ["search","web"],
    variants: [
      {
        id: "simple",
        label: "Simple",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            max_results: { type: "number", default: 5 }
          },
          required: ["query"]
        }
      },
      {
        id: "advanced",
        label: "Advanced",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            time_limit: { type: "string", description: "e.g., d|w|m for day/week/month window" },
            region: { type: "string", description: "e.g., wt-wt" },
            safesearch: { type: "string", enum: ["off","moderate","strict"], default: "moderate" },
            max_results: { type: "number", default: 10 }
          },
          required: ["query"]
        }
      }
    ]
  },
  {
    id: "news.search",
    name: "News Search",
    description: "Search recent news across reputable sources.",
    runtime: "llm_tool",
    variants: [
      {
        id: "default",
        label: "Default",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            time_limit: { type: "string", description: "e.g., d|w|m" },
            max_results: { type: "number", default: 5 }
          },
          required: ["query"]
        }
      }
    ]
  },
  {
    id: "scores.lookup",
    name: "Scores Lookup",
    description: "Get latest sports scores or schedules.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string", enum: ["nba","nfl","mlb","nhl","epl"], description: "Sports league" },
        team: { type: "string", description: "Optional team code for filtering" },
        date: { type: "string", description: "YYYY-MM-DD optional" }
      },
      required: ["league"]
    }
  },
  {
    id: "sharepoint.search",
    name: "SharePoint Search",
    description: "Search SharePoint sites for files by keyword or metadata.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site id or path" },
        query: { type: "string" },
        mime_types: { type: "array", items: { type: "string" } },
        top: { type: "number", default: 10 }
      },
      required: ["site","query"]
    }
  },
  {
    id: "onedrive.search",
    name: "OneDrive Search",
    description: "Search a OneDrive for files.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "User or drive id" },
        query: { type: "string" },
        top: { type: "number", default: 10 }
      },
      required: ["owner","query"]
    }
  },
  {
    id: "s3.get_object",
    name: "S3 Get Object",
    description: "Fetch an object from S3, returning an artifact reference.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        bucket: { type: "string" },
        key: { type: "string" },
        version_id: { type: "string" }
      },
      required: ["bucket","key"]
    }
  },
  {
    id: "http.get",
    name: "HTTP GET",
    description: "Make a GET request to a URL; returns status, headers, and body.",
    runtime: "llm_tool",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        timeout_ms: { type: "number", default: 10000 }
      },
      required: ["url"]
    }
  }
];

export const DefaultToolRegistry: ToolRegistry = {
  list: () => TOOLS.slice(),
  get: (id: string) => TOOLS.find(t => t.id === id)
};
```

---

### 3) **NEW** `lib/schema_example.ts` — create minimal examples from JSON Schema

```ts
// src/modules/agent-builder/lib/schema_example.ts
import type { JsonSchema } from "../model/tools";

export function exampleFromSchema(s?: JsonSchema): any {
  if (!s) return {};
  if (Array.isArray(s.type)) {
    // pick first type
    return exampleFromSchema({ ...s, type: s.type[0] });
  }
  switch (s.type) {
    case "string":
      if (s.enum?.length) return s.enum[0];
      return s.default ?? "";
    case "number":
    case "integer":
      // @ts-ignore
      return s.default ?? 0;
    case "boolean":
      // @ts-ignore
      return s.default ?? false;
    case "array":
      return [exampleFromSchema(s.items)];
    case "object":
      const out: Record<string, any> = {};
      const props = s.properties ?? {};
      for (const k of Object.keys(props)) {
        out[k] = exampleFromSchema(props[k]);
      }
      return out;
    default:
      return s.default ?? null;
  }
}
```

---

### 4) **NEW** `components/Tools/ToolSchemaViewer.tsx` — collapsible viewer

```tsx
// src/modules/agent-builder/components/Tools/ToolSchemaViewer.tsx
import React, { useMemo, useState } from "react";
import type { JsonSchema, ToolDef, ToolVariant } from "../../model/tools";
import { exampleFromSchema } from "../../lib/schema_example";

type Props = {
  tool: ToolDef;
  variant?: ToolVariant | null;
};

export const ToolSchemaViewer: React.FC<Props> = ({ tool, variant }) => {
  const schema = variant?.parameters ?? tool.parameters;
  const ex = useMemo(() => exampleFromSchema(schema), [schema]);
  const [open, setOpen] = useState(false);
  if (!schema) return null;
  return (
    <div className="ab-tool-schema">
      <button className="ab-btn" onClick={() => setOpen(o => !o)}>
        {open ? "Hide" : "Show"} Schema
      </button>
      {open && (
        <div className="ab-schema-panels">
          <div>
            <label>Parameters JSON Schema</label>
            <pre className="ab-pre">{JSON.stringify(schema, null, 2)}</pre>
          </div>
          <div>
            <label>Example Arguments</label>
            <pre className="ab-pre">{JSON.stringify(ex, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### 5) **NEW** `components/Tools/AgentToolsPicker.tsx` — main selection UI

```tsx
// src/modules/agent-builder/components/Tools/AgentToolsPicker.tsx
import React, { useMemo, useState } from "react";
import type { AgentNode, ToolRef } from "../../model/ir";
import type { ToolDef, ToolRegistry } from "../../model/tools";
import { ToolSchemaViewer } from "./ToolSchemaViewer";

type Props = {
  node: AgentNode;
  onChange: (next: AgentNode) => void;
  registry: ToolRegistry;
};

function searchMatch(q: string, t: ToolDef): boolean {
  const s = q.toLowerCase();
  return t.id.includes(s) || t.name.toLowerCase().includes(s) || (t.tags ?? []).some(tag => tag.includes(s));
}

export const AgentToolsPicker: React.FC<Props> = ({ node, onChange, registry }) => {
  const [q, setQ] = useState("");
  const tools = useMemo(() => registry.list().filter(t => !q ? true : searchMatch(q, t)), [registry, q]);
  const selected = new Map((node.config?.allowedTools ?? []).map(r => [r.toolId, r.variantId ?? null]));

  const toggleTool = (toolId: string) => {
    const current = node.config?.allowedTools ?? [];
    const exists = current.find(t => t.toolId === toolId);
    const next: ToolRef[] = exists ? current.filter(t => t.toolId !== toolId) : [...current, { toolId }];
    onChange({ ...node, config: { ...(node.config ?? {}), allowedTools: next } });
  };

  const setVariant = (toolId: string, variantId: string | undefined) => {
    const current = node.config?.allowedTools ?? [];
    const next: ToolRef[] = current.map(t => t.toolId === toolId ? { ...t, variantId } : t);
    onChange({ ...node, config: { ...(node.config ?? {}), allowedTools: next } });
  };

  return (
    <div className="ab-tools-picker">
      <div className="ab-tools-search">
        <input className="ab-input" placeholder="Search tools..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="ab-tools-list">
        {tools.map(t => {
          const isSelected = selected.has(t.id);
          const vId = selected.get(t.id) ?? undefined;
          const variant = (t.variants ?? []).find(v => v.id === vId) ?? null;
          return (
            <li key={t.id} className={`ab-tool ${isSelected ? "is-selected" : ""}`}>
              <div className="ab-tool-head">
                <label className="ab-checkline">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleTool(t.id)} />
                  <span className="ab-tool-title">{t.name}</span>
                  <code className="ab-tool-id">{t.id}</code>
                </label>
                <span className="ab-chip">{t.runtime}</span>
              </div>
              <div className="ab-tool-desc">{t.description}</div>
              {t.variants && t.variants.length > 0 && isSelected && (
                <div className="ab-field">
                  <label className="ab-label">Variant</label>
                  <select className="ab-select" value={vId ?? ""} onChange={(e) => setVariant(t.id, e.target.value || undefined)}>
                    <option value="">(default)</option>
                    {t.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
              )}
              <ToolSchemaViewer tool={t} variant={variant ?? undefined} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
```

---

### 6) **UPDATE** `components/NodeCard/AgentCard.tsx` — include the picker

Add a **“Tools”** section that renders `AgentToolsPicker` and persists to `node.config.allowedTools`.

```tsx
// src/modules/agent-builder/components/NodeCard/AgentCard.tsx
import React from "react";
import type { AgentNode } from "../../model/ir";
import { DefaultToolRegistry } from "../../registry/tools.default";
import { AgentToolsPicker } from "../Tools/AgentToolsPicker";

type Props = { node: AgentNode; onChange: (next: AgentNode) => void };

export const AgentCard: React.FC<Props> = ({ node, onChange }) => {
  const cfg = node.config ?? {};
  return (
    <div className="ab-card">
      <label>Model</label>
      <input
        className="ab-input"
        type="text"
        value={cfg.model ?? ""}
        onChange={(e) => onChange({ ...node, config: { ...cfg, model: e.target.value } })}
      />

      <div className="ab-divider" />

      <h4>Tools</h4>
      <AgentToolsPicker node={node} onChange={onChange} registry={DefaultToolRegistry} />
    </div>
  );
};
```

If PR‑AB‑006 added Combiner mode to `AgentCard`, merge the two sections (Model + Combiner + Tools).

---

### 7) **NEW** tests

```
src/modules/agent-builder/components/Tools/__tests__/AgentToolsPicker.spec.tsx
src/modules/agent-builder/components/Tools/__tests__/ToolSchemaViewer.spec.tsx
src/modules/agent-builder/lib/__tests__/schema_example.spec.ts
```

**`AgentToolsPicker.spec.tsx`** — pick tool & variant

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentToolsPicker } from "../../AgentToolsPicker";

const registry = {
  list: () => ([
    { id: "web.search", name: "Web Search", description: "", runtime: "llm_tool", variants: [{ id: "simple", label: "Simple", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }] }
  ]),
  get: (id: string) => ({ id, name: "Web Search", description: "", runtime: "llm_tool", variants: [{ id: "simple", label: "Simple", parameters: { type: "object" } }] })
} as any;

describe("AgentToolsPicker", () => {
  it("selects a tool and variant", () => {
    const node: any = { id: "a", kind: "agent", config: { allowedTools: [] } };
    const onChange = (next: any) => Object.assign(node, next);
    render(<AgentToolsPicker node={node} onChange={onChange} registry={registry} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(node.config.allowedTools[0].toolId).toBe("web.search");
    const select = screen.getByLabelText("Variant");
    fireEvent.change(select, { target: { value: "simple" } });
    expect(node.config.allowedTools[0].variantId).toBe("simple");
  });
});
```

**`ToolSchemaViewer.spec.tsx`** — renders schema & example

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolSchemaViewer } from "../../ToolSchemaViewer";

describe("ToolSchemaViewer", () => {
  it("shows schema and example", () => {
    const tool: any = { id: "t", name: "T", description: "", runtime: "llm_tool", parameters: { type: "object", properties: { x: { type: "number" } } } };
    render(<ToolSchemaViewer tool={tool} />);
    fireEvent.click(screen.getByText(/Show Schema/));
    expect(screen.getByText(/Parameters JSON Schema/)).toBeTruthy();
    expect(screen.getByText(/Example Arguments/)).toBeTruthy();
  });
});
```

**`schema_example.spec.ts`** — example generation

```ts
import { describe, it, expect } from "vitest";
import { exampleFromSchema } from "../../schema_example";

describe("exampleFromSchema", () => {
  it("creates object examples", () => {
    const s = { type: "object", properties: { a: { type: "string" }, b: { type: "number" }, c: { type: "boolean" }, d: { type: "array", items: { type: "string" } } } };
    const ex = exampleFromSchema(s as any);
    expect(typeof ex.a).toBe("string");
    expect(typeof ex.b).toBe("number");
    expect(Array.isArray(ex.d)).toBe(true);
  });
});
```

---

### 8) **Styles** (extend builder CSS)

```css
/* Tools */
.ab-tools-picker { display: grid; gap: 10px; }
.ab-tools-search { display: flex; gap: 8px; }
.ab-tools-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.ab-tool { border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: var(--card); }
.ab-tool.is-selected { outline: 2px solid var(--brand); }
.ab-tool-head { display: flex; justify-content: space-between; align-items: center; }
.ab-tool-title { font-weight: 600; margin-right: 8px; }
.ab-tool-id { opacity: 0.7; margin-left: 8px; }
.ab-tool-desc { font-size: 13px; opacity: 0.9; margin: 6px 0 10px; }
.ab-schema-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
```

---

## Acceptance Criteria

- A **Tool Registry** exists with a typed API and a default set of tools (search, news, scores, SharePoint/OneDrive, S3, HTTP).  
- **AgentToolsPicker** allows selecting tools, choosing a variant when available, and shows the JSON Schema + example arguments.  
- Selections persist to `AgentNode.config.allowedTools: ToolRef[]`.  
- **AgentCard** renders the Tools picker (coexisting with model/Combiner UI if present).  
- Tests cover: selecting tools/variants, schema viewer rendering, and example generation. **≥80%** coverage for new files.

---

## How to Review & Test

```bash
pnpm i
pnpm test
# In the builder, open an Agent node → Tools section:
# - Search “web” → check “Web Search” → choose variant “Simple”.
# - Expand “Show Schema” to view parameters and example payload.
# - Confirm IR updates in the in-memory doc (allowedTools contains { toolId, variantId }).
```

---

## Follow‑ups

- **PR‑AB‑008:** Exporter reads `allowedTools` & emits tool specs (OpenAI function tools) in the engine request.  
- **PR‑AB‑009:** Preview/test runner that lets you mock tool results and visualize LLM/tool SSE.  
- **PR‑AB‑010:** Remote registries (MCP servers) and capability discovery.
