
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR05 — Tool Attach Flow (Web Search) + Agent Tool Policy & Overrides

## Summary
Add a simple **Tool Registry** (client‑side metadata) and an **Agent Tool Config** inspector so builders can attach the **Web Search** tool to any `agent.codeless` node, configure policy/timeouts, and set **parameter overrides** with **LLMHidden**/**AgentOverride** semantics reflected in the exported IR. The Test panel continues to use the same IR, so runs immediately benefit from tool configuration.

> Scope: Front‑end only — registry metadata, right‑pane Inspector UI, IR serialization/validation, and unit tests. No additional runtime deps.

---

## Purpose
- Let users attach one or more tools (starting with **Web Search**) to an agent.
- Expose per‑agent **tool policy** and safeguards (`timeoutMs`, `maxCallsPerTurn`, `parallelism`, `redactPII`).
- Allow **parameter overrides** for each tool and mark fields as **LLMHidden** (withheld from model schema) or **AgentOverride** (visible to model but overwritten at execution).
- Keep everything typed, minimal, and easy to extend (future enterprise tools).

---

## Files to Add / Change

```
src/
  lib/
    tools/
      registry.ts                   # Tool registry types + in‑memory list (start with web-search)
      shapes.ts                     # Shared types for overrides + visibility flags
      builtins/
        webSearch.meta.ts           # Metadata: display info + args schema
    orch/
      ir/
        transform.ts                # Helpers to read/write tool config to/from IR nodes
  features/
    inspector/
      ToolConfigPanel.tsx           # Main UI: attach, policy, per‑tool overrides
      fields/
        ArgEditor.tsx               # Generic arg editor (string/number/enum/boolean/object)
  state/
    selection.ts                    # (if present) ensure selected node shape includes tools view model
  app/
    config.ts                       # unchanged; present for completeness
__tests__/
  tools.registry.spec.ts            # Registry & metadata tests
  ir.transform.tools.spec.ts        # IR <-> view model round‑trip
  toolconfig.panel.spec.tsx         # Render attach/config/editor; simple interactions
```

> Place files under your existing feature/module structure if paths differ — keep `lib/tools/*` decoupled from canvas so other views can reuse.

---

## Design

### Tool Registry
A **pure metadata** registry describing tools available to attach. It is not the execution layer. For each tool we expose:
- `toolId` (e.g., `"tool:web-search"`)
- `name`, `version`, `summary`
- `argsSchema` (JSON‑ish schema for the editor)
- (optional) safe defaults
- (optional) fields supporting **visibility**: `"Normal" | "LLMHidden" | "AgentOverride"`

### Agent Tool Policy
Stored on the agent node at `node.data.tools` to match your IR:
```ts
{
  policy: "Disabled" | "Auto" | "AlwaysAsk" | "Heuristic",
  timeoutMs?: number,
  maxCallsPerTurn?: number,
  parallelism?: number,
  redactPII?: boolean,
  attached: string[] // array of tool node IDs
}
```
Also allow per‑tool `parameterOverrides` in the **tool node** object so the engine can apply LLMHidden/AgentOverride behavior at call time.

---

## Implementation

### 1) Types (`src/lib/tools/shapes.ts`)

```ts
export type Visibility = "Normal" | "LLMHidden" | "AgentOverride";

export type ArgSchema =
  | { kind: "string"; name: string; label?: string; placeholder?: string; visibility?: Visibility; enum?: string[]; multiline?: boolean; required?: boolean }
  | { kind: "number"; name: string; label?: string; min?: number; max?: number; step?: number; visibility?: Visibility; required?: boolean }
  | { kind: "boolean"; name: string; label?: string; visibility?: Visibility }
  | { kind: "object"; name: string; label?: string; properties: ArgSchema[]; visibility?: Visibility }
  ;

export type ToolMeta = {
  toolId: string;               // e.g., "tool:web-search"
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
```

### 2) Registry (`src/lib/tools/registry.ts`)

```ts
import type { ToolMeta } from "./shapes";
import webSearch from "./builtins/webSearch.meta";

const ALL: ToolMeta[] = [webSearch];

export function listTools(): ToolMeta[] { return ALL.slice(); }
export function getToolById(toolId: string): ToolMeta | undefined { return ALL.find(t => t.toolId === toolId); }
```

### 3) Built‑in Web Search (`src/lib/tools/builtins/webSearch.meta.ts`)

```ts
import type { ToolMeta } from "../shapes";

const meta: ToolMeta = {
  toolId: "tool:web-search",
  name: "Web Search",
  version: "1.0.0",
  summary: "Searches the public web and returns results with titles, urls, and snippets.",
  argsSchema: [
    { kind: "string", name: "query", label: "Query", placeholder: "What do you want to find?", required: true },
    { kind: "string", name: "site", label: "Site (optional)", placeholder: "example.com", visibility: "AgentOverride" },
    { kind: "string", name: "recency", label: "Recency Window", placeholder: "30d | 7d | 0", visibility: "AgentOverride" },
    { kind: "number", name: "limit", label: "Max Results", min: 1, max: 20, step: 1, visibility: "AgentOverride" },
    { kind: "boolean", name: "safeSearch", label: "Safe Search", visibility: "AgentOverride" },
    // Example of a value not sent to the LLM:
    { kind: "string", name: "apiKeyRef", label: "API Key Ref", visibility: "LLMHidden", placeholder: "secrets/search-api" }
  ],
  defaults: { limit: 5, safeSearch: true, recency: "30d" }
};

export default meta;
```

> `apiKeyRef` is **LLMHidden** — never exposed in the tool schema sent to the model. The engine will inject it at invocation time.

### 4) IR transforms (`src/lib/orch/ir/transform.ts`)

Helpers to **read** tool config out of an IR and to **write** the user’s edits back.

```ts
import type { AgentToolBinding, ToolOverrides, Visibility } from "../../tools/shapes";
import { getToolById } from "../../tools/registry";

export function readAgentToolsFromIR(node: any, allNodes: any[]): AgentToolBinding[] {
  const attachedIds: string[] = node?.data?.tools?.attached ?? [];
  const bindings: AgentToolBinding[] = [];
  for (const toolNodeId of attachedIds) {
    const toolNode = allNodes.find(n => n.id === toolNodeId);
    if (!toolNode) continue;
    const toolId = toolNode?.data?.toolId ?? toolNode?.data?.name ?? "";
    const meta = getToolById(toolId);
    const overridesRaw = toolNode?.data?.parameterOverrides ?? {};
    const overrides: ToolOverrides = {};
    if (meta) {
      for (const def of meta.argsSchema) {
        const ov = overridesRaw[def.name];
        const vis: Visibility = (ov?.visibility) || (def as any).visibility || "Normal";
        const value = ov?.value ?? ov ?? (meta.defaults ? meta.defaults[def.name] : undefined);
        overrides[def.name] = { value, visibility: vis };
      }
    }
    bindings.push({ toolNodeId, toolId, overrides });
  }
  return bindings;
}

export function writeAgentToolsToIR(node: any, allNodes: any[], bindings: AgentToolBinding[]): { node: any, nodes: any[] } {
  // ensure attached list
  const attached = bindings.map(b => b.toolNodeId);
  node = { ...node, data: { ...node.data, tools: { ...(node.data?.tools || {}), attached } } };

  const nodes = allNodes.map(n => {
    const bind = bindings.find(b => b.toolNodeId === n.id);
    if (!bind) return n;
    const paramOv: Record<string, any> = {};
    for (const [name, ov] of Object.entries(bind.overrides || {})) {
      paramOv[name] = { value: ov.value, visibility: ov.visibility };
    }
    return {
      ...n,
      data: {
        ...(n.data || {}),
        toolId: bind.toolId,
        parameterOverrides: paramOv
      }
    };
  });

  return { node, nodes };
}
```

### 5) Generic Arg Editor (`src/features/inspector/fields/ArgEditor.tsx`)

```tsx
import React from "react";
import type { ArgSchema, Visibility } from "../../../lib/tools/shapes";

type Props = {
  schema: ArgSchema;
  value: any;
  visibility: Visibility;
  onChange: (value:any) => void;
  onVisibilityChange: (v: Visibility) => void;
};

export default function ArgEditor({ schema, value, visibility, onChange, onVisibilityChange }: Props) {
  const label = (schema as any).label ?? schema.name;
  const visOpts: Visibility[] = ["Normal","AgentOverride","LLMHidden"];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm">{label}</label>
        <select className="ml-auto bg-neutral-900 text-neutral-50 text-xs rounded px-2 py-1"
                value={visibility} onChange={e => onVisibilityChange(e.target.value as Visibility)}>
          {visOpts.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {schema.kind === "string" && (
        <input className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
               placeholder={(schema as any).placeholder}
               value={value ?? ""} onChange={e => onChange(e.target.value)} />
      )}
      {schema.kind === "number" && (
        <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
               value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      )}
      {schema.kind === "boolean" && (
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {label}
        </label>
      )}
      {/* Simple nested object editor (flat list) */}
      {schema.kind === "object" && Array.isArray(schema.properties) && (
        <div className="space-y-2 pl-2 border-l border-neutral-800">
          {schema.properties.map((p,i) => (
            <ArgEditor key={i} schema={p} value={value?.[p.name]}
              visibility={(p as any).visibility || "Normal"
              }
              onChange={(v:any) => onChange({ ...(value||{}), [p.name]: v })}
              onVisibilityChange={() => { /* nested vis not editable here */ }} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6) Tool Config Panel (`src/features/inspector/ToolConfigPanel.tsx`)

```tsx
import React, { useMemo, useState } from "react";
import { listTools, getToolById } from "../../lib/tools/registry";
import type { AgentToolBinding, ToolOverrides, Visibility } from "../../lib/tools/shapes";
import ArgEditor from "./fields/ArgEditor";
import { readAgentToolsFromIR, writeAgentToolsToIR } from "../../lib/orch/ir/transform";

type Props = {
  graph: { nodes: any[] };
  selectedNodeId: string;
  onGraphChange: (next: { nodes: any[] }) => void;
};

export default function ToolConfigPanel({ graph, selectedNodeId, onGraphChange }: Props) {
  const node = graph.nodes.find(n => n.id === selectedNodeId);
  const isAgent = node?.kind === "agent.codeless";
  const [bindings, setBindings] = useState<AgentToolBinding[]>(() => isAgent ? readAgentToolsFromIR(node, graph.nodes) : []);

  const allTools = useMemo(() => listTools(), []);

  if (!isAgent) return <div className="text-sm opacity-60 p-2">Select a Codeless Agent to configure tools.</div>;

  const updateBinding = (toolNodeId: string, draft: Partial<AgentToolBinding>) => {
    setBindings(prev => prev.map(b => b.toolNodeId === toolNodeId ? { ...b, ...draft } : b));
  };

  const addTool = (toolId: string) => {
    const meta = getToolById(toolId);
    if (!meta) return;
    const toolNodeId = crypto.randomUUID();
    const overrides: ToolOverrides = {};
    for (const def of meta.argsSchema) {
      const vis: Visibility = (def as any).visibility || "Normal";
      const defVal = meta.defaults ? meta.defaults[def.name] : undefined;
      overrides[def.name] = { value: defVal, visibility: vis };
    }
    setBindings(prev => [...prev, { toolNodeId, toolId, overrides }]);
  };

  const removeTool = (toolNodeId: string) => {
    setBindings(prev => prev.filter(b => b.toolNodeId !== toolNodeId));
  };

  const save = () => {
    const { node: nextNode, nodes: nextNodes } = writeAgentToolsToIR(node, graph.nodes, bindings);
    onGraphChange({ nodes: nextNodes.map(n => n.id === nextNode.id ? nextNode : n) });
  };

  const policy = node?.data?.tools || {};
  const setPolicy = (key: string, val: any) => {
    const nextNode = {
      ...node,
      data: { ...node.data, tools: { ...(node.data?.tools || {}), [key]: val } }
    };
    const nextNodes = graph.nodes.map(n => n.id === nextNode.id ? nextNode : n);
    onGraphChange({ nodes: nextNodes });
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-2">
        <div className="text-xs uppercase opacity-70">Tool policy</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Policy
            <select className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.policy || "Auto"} onChange={e => setPolicy("policy", e.target.value)}>
              <option>Disabled</option><option>Auto</option><option>AlwaysAsk</option><option>Heuristic</option>
            </select>
          </label>
          <label className="text-sm">Timeout (ms)
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.timeoutMs ?? 10000} onChange={e => setPolicy("timeoutMs", Number(e.target.value))} />
          </label>
          <label className="text-sm">Max calls/turn
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.maxCallsPerTurn ?? 0} onChange={e => setPolicy("maxCallsPerTurn", Number(e.target.value))} />
          </label>
          <label className="text-sm">Parallelism
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.parallelism ?? 1} onChange={e => setPolicy("parallelism", Number(e.target.value))} />
          </label>
          <label className="text-sm inline-flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={!!policy.redactPII} onChange={e => setPolicy("redactPII", e.target.checked)} />
            Redact PII in telemetry and tool payload samples
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase opacity-70">Attached tools</div>
        <div className="flex gap-2">
          <select className="bg-neutral-900 text-neutral-50 rounded px-2 py-1"
                  onChange={(e) => { if (e.target.value) { addTool(e.target.value); e.target.value=""; } }}>
            <option value="">+ Add tool…</option>
            {allTools.map(t => <option key={t.toolId} value={t.toolId}>{t.name}</option>)}
          </select>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={save}>Save</button>
        </div>

        <div className="space-y-3">
          {bindings.map(b => {
            const meta = getToolById(b.toolId);
            if (!meta) return null;
            return (
              <div key={b.toolNodeId} className="rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm">{meta.name} <span className="opacity-60">({meta.version})</span></div>
                  <button className="ml-auto text-xs px-2 py-1 rounded bg-neutral-800" onClick={() => removeTool(b.toolNodeId)}>Remove</button>
                </div>
                <div className="grid gap-3">
                  {meta.argsSchema.map((def, i) => (
                    <ArgEditor key={i}
                      schema={def}
                      value={b.overrides[def.name]?.value}
                      visibility={b.overrides[def.name]?.visibility || (def as any).visibility || "Normal"}
                      onChange={(v:any) => updateBinding(b.toolNodeId, {
                        overrides: { ...b.overrides, [def.name]: { value: v, visibility: b.overrides[def.name]?.visibility || (def as any).visibility || "Normal" } }
                      })}
                      onVisibilityChange={(vis:any) => updateBinding(b.toolNodeId, {
                        overrides: { ...b.overrides, [def.name]: { value: b.overrides[def.name]?.value, visibility: vis } }
                      })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs opacity-70">
        <p className="mb-1"><strong>LLMHidden</strong>: not included in the tool schema sent to the model; injected at execution time.</p>
        <p><strong>AgentOverride</strong>: included in the schema but overwritten before executing the tool.</p>
      </div>
    </div>
  );
}
```

### 7) Integration notes
- Mount `ToolConfigPanel` in the right inspector when a `agent.codeless` node is selected (e.g., provide tabs: **Agent**, **Tools**, **Node**).
- The **Save** button persists changes into the IR via `writeAgentToolsToIR` so **export** and **Test** use the same structure.
- The Test panel **does not** need changes; it already posts the IR to the engine.

---

## Tests

`tools.registry.spec.ts`
- Assert that `listTools()` returns the Web Search meta and `getToolById("tool:web-search")` is defined.
- Validate default values & arg visibility for key fields (e.g., `apiKeyRef` is `LLMHidden`).

`ir.transform.tools.spec.ts`
- Build a minimal IR with an agent + tool node; read bindings; update overrides; write back; verify round‑trip preserves attached ids and per‑arg visibility/value.
- Confirm that when adding a new tool binding, the tool node receives `data.parameterOverrides` with `{ value, visibility }` shape.

`toolconfig.panel.spec.tsx`
- Render panel with a selected agent; add Web Search; change `limit`, toggle `safeSearch`, set `apiKeyRef`, flip visibilities; click **Save**; ensure `onGraphChange` receives an IR with expected overrides.

---

## Acceptance Criteria
- Users can attach **Web Search** to any `agent.codeless` node and configure policy + overrides.
- Per‑arg visibility flags **persist** to the IR as `{ value, visibility }` and match semantics:
  - `LLMHidden` → withheld from model schema (engine responsibility).
  - `AgentOverride` → included in schema but overwritten on execution (engine responsibility).
- Exported IR matches the project schema (`node.data.tools.*`, tool node `parameterOverrides`).
- Tests pass and TypeScript remains strict; no new heavy dependencies.

---

## Validation (manual)
1) Select an agent; open **Tools** tab; **Add tool… → Web Search**.  
2) Set `site=example.com` (AgentOverride), `apiKeyRef=secrets/search-api` (LLMHidden), `limit=5`.  
3) Save; export IR; verify tool node has `parameterOverrides` with the expected visibilities and values.  
4) Test chat: ask something that triggers the tool; observe streamed **tool_result** widget (from UI‑PR02) and telemetry (UI‑PR04).

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** inspector panel components are small; avoid nested complexity.  
- **Types everywhere:** schema‑driven editor; no `any` in public types.  
- **Async correctness:** “Save” is synchronous IR transform; no network.  
- **Minimal deps:** no form libs; keep editor simple and typed.  
- **Performance:** avoid re‑creating large objects; memoize lists; debounce expensive operations if needed.  
- **Security:** never store real secrets in the client; only **refs** (e.g., `apiKeyRef`) — label clearly.  
- **A11y:** labeled inputs, keyboard navigation, focus management.  
- **Config:** tool registry is data‑driven; adding tools shouldn’t require wiring in multiple places.  
- **Errors:** validate required args; surface friendly inline messages.  
- **Tests:** deterministic; no network; round‑trip IR coverage.  
- **Extensibility:** new tools register only metadata; the editor renders automatically from `argsSchema`.
