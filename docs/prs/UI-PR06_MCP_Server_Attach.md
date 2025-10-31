
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR06 — MCP Server Nodes: Create/Edit + Attach to Agents (Edges) + Namespace Filter

## Summary
Add first‑class **MCP Server** support to the Agent Builder UI. Editors must be able to:
1) **Create & edit** MCP server nodes (URL, protocol, auth, capabilities, namespace filter, metadata).  
2) **Attach servers to agents** by adding edges `agent.codeless → mcpServer`.  
3) Round‑trip these changes in the **IR export/import** with strict typing and tests.

This PR is **front‑end only** and follows the IR shapes you already use (see `MCPServerNode` in your schema). The runtime engine already knows how to consume these server nodes.

---

## Purpose
- Make MCP endpoints a first‑class concept in the canvas.  
- Let builders wire an agent to one or more MCP servers (e.g., OneDrive) with clear auth semantics.  
- Keep the graph easy to extend: adding a new server type requires no code beyond metadata.

---

## Files to Add / Change

```
src/
  lib/
    mcp/
      shapes.ts                  # Types for MCP server config (auth, capabilities, etc.)
      ir.ts                      # Read/Write helpers for nodes + edges (attach/detach servers)
      registry.ts                # (Optional) enums/defaults for protocol/auth dropdowns
  features/
    inspector/
      McpServerPanel.tsx         # Create/Edit an MCP server node
      AgentMcpAttach.tsx         # Attach/detach servers to the selected agent (manages edges)
  features/
    test-panel/
      components/TestChatPane.tsx # (no logic change; optional UI hint that servers exist)
__tests__/
  mcp.ir.spec.ts                 # IR round‑trip tests for nodes and edges
  mcp.panels.spec.tsx            # Render/edit server node, attach to agent
```

> If your module layout differs, co‑locate within your existing feature folders while keeping `lib/mcp/*` reusable and framework‑agnostic.

---

## Types (`src/lib/mcp/shapes.ts`)

```ts
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
```

---

## IR Helpers (`src/lib/mcp/ir.ts`)

```ts
import type { Graph, McpServerNode } from "./shapes";

export function listMcpServers(graph: Graph): McpServerNode[] {
  return (graph.nodes || []).filter(n => n?.kind === "mcpServer") as McpServerNode[];
}

export function upsertMcpServer(graph: Graph, node: Partial<McpServerNode>): Graph {
  const id = node.id ?? (globalThis.crypto?.randomUUID?.() || String(Math.random()));
  const idx = graph.nodes.findIndex(n => n.id === id);
  const full: McpServerNode = {
    id,
    kind: "mcpServer",
    label: node.label || "MCP Server",
    data: {
      url: node.data?.url || "",
      protocol: node.data?.protocol || "mcp/1.0",
      auth: node.data?.auth || { type: "client_credentials", secretRef: null },
      capabilities: node.data?.capabilities || { tools: true, resources: false, prompts: false, sampling: false },
      namespaceFilter: node.data?.namespaceFilter || [],
      metadata: node.data?.metadata || {}
    }
  };
  const nodes = [...graph.nodes];
  if (idx >= 0) nodes[idx] = full; else nodes.push(full);
  return { ...graph, nodes };
}

export function removeMcpServer(graph: Graph, serverId: string): Graph {
  const nodes = (graph.nodes || []).filter(n => n.id !== serverId);
  const edges = (graph.edges || []).filter(e => !(e.from === serverId || e.to === serverId));
  return { ...graph, nodes, edges };
}

// Agent ↔ MCP edges
export function getAgentAttachedServers(graph: Graph, agentId: string): string[] {
  return (graph.edges || []).filter(e => e.from === agentId)
    .map(e => e.to)
    .filter(to => (graph.nodes || []).some(n => n.id === to && n.kind === "mcpServer"));
}

export function setAgentAttachedServers(graph: Graph, agentId: string, serverIds: string[]): Graph {
  const keep = (graph.edges || []).filter(e => !(e.from === agentId && (graph.nodes || []).some(n => n.id === e.to && n.kind === "mcpServer")));
  const newEdges = serverIds.map((sid) => ({
    id: `${agentId}→${sid}`,
    from: agentId,
    to: sid,
    label: ""
  }));
  return { ...graph, edges: [...keep, ...newEdges] };
}
```

---

## Registry (`src/lib/mcp/registry.ts`)

```ts
export const KNOWN_PROTOCOLS = ["mcp/1.0"];
export const KNOWN_AUTH: Array<"OBO" | "client_credentials" | "api_key" | "mtls"> = ["OBO","client_credentials","api_key","mtls"];
```

---

## Server Editor Panel (`src/features/inspector/McpServerPanel.tsx`)

```tsx
import React, { useMemo, useState } from "react";
import { KNOWN_PROTOCOLS, KNOWN_AUTH } from "../../lib/mcp/registry";
import { upsertMcpServer, removeMcpServer } from "../../lib/mcp/ir";
import type { Graph } from "../../lib/mcp/shapes";

type Props = {
  graph: Graph;
  selectedNodeId?: string;              // if selected is an MCP server, we edit; otherwise we create
  onGraphChange: (g: Graph) => void;
};

export default function McpServerPanel({ graph, selectedNodeId, onGraphChange }: Props) {
  const selected = useMemo(() => graph.nodes.find(n => n.id === selectedNodeId && n.kind === "mcpServer"), [graph, selectedNodeId]);
  const [draft, setDraft] = useState<any>(selected || { kind: "mcpServer", label: "MCP Server", data: { protocol: "mcp/1.0", capabilities: { tools: true } } });

  const save = () => onGraphChange(upsertMcpServer(graph, draft));
  const del  = () => { if (selected?.id) onGraphChange(removeMcpServer(graph, selected.id)); };

  const d = draft.data || (draft.data = {});

  return (
    <div className="space-y-3 p-3">
      <div className="text-xs uppercase opacity-70">MCP Server</div>
      <label className="text-sm block">Label
        <input className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={draft.label || ""} onChange={e => setDraft({ ...draft, label: e.target.value })} />
      </label>
      <label className="text-sm block">URL
        <input className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={d.url || ""} onChange={e => setDraft({ ...draft, data: { ...d, url: e.target.value } })} />
      </label>
      <label className="text-sm block">Protocol
        <select className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={d.protocol || "mcp/1.0"} onChange={e => setDraft({ ...draft, data: { ...d, protocol: e.target.value } })}>
          {KNOWN_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Auth
          <select className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={d.auth?.type || "client_credentials"} onChange={e => setDraft({ ...draft, data: { ...d, auth: { ...(d.auth || {}), type: e.target.value } } })}>
            {KNOWN_AUTH.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm">Secret Ref
          <input className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={d.auth?.secretRef || ""} onChange={e => setDraft({ ...draft, data: { ...d, auth: { ...(d.auth || {}), secretRef: e.target.value } } })} />
        </label>
        <label className="text-sm col-span-2">Scopes (comma‑sep)
          <input className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={(d.auth?.scopes || []).join(", ")} onChange={e => setDraft({ ...draft, data: { ...d, auth: { ...(d.auth || {}), scopes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } } })} />
        </label>
      </div>

      <div className="space-y-1">
        <div className="text-xs uppercase opacity-70">Capabilities</div>
        <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!d.capabilities?.tools} onChange={e => setDraft({ ...draft, data: { ...d, capabilities: { ...(d.capabilities || {}), tools: e.target.checked } } })} />Tools</label>
        <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!d.capabilities?.resources} onChange={e => setDraft({ ...draft, data: { ...d, capabilities: { ...(d.capabilities || {}), resources: e.target.checked } } })} />Resources</label>
        <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!d.capabilities?.prompts} onChange={e => setDraft({ ...draft, data: { ...d, capabilities: { ...(d.capabilities || {}), prompts: e.target.checked } } })} />Prompts</label>
        <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!d.capabilities?.sampling} onChange={e => setDraft({ ...draft, data: { ...d, capabilities: { ...(d.capabilities || {}), sampling: e.target.checked } } })} />Sampling</label>
      </div>

      <label className="text-sm block">Namespace filter (comma‑sep)
        <input className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1" value={(d.namespaceFilter || []).join(", ")} onChange={e => setDraft({ ...draft, data: { ...d, namespaceFilter: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })} />
      </label>

      <div className="flex gap-2">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={save}>Save</button>
        {selected && <button className="px-3 py-1 bg-red-700 text-white rounded" onClick={del}>Delete</button>}
      </div>

      <div className="text-xs opacity-70">
        Store only **secret references** (e.g., `secrets/onedrive-cc`) — never actual credentials.
      </div>
    </div>
  );
}
```

---

## Agent Attach Panel (`src/features/inspector/AgentMcpAttach.tsx`)

```tsx
import React from "react";
import { listMcpServers, setAgentAttachedServers, getAgentAttachedServers } from "../../lib/mcp/ir";
import type { Graph } from "../../lib/mcp/shapes";

type Props = {
  graph: Graph;
  agentId: string;
  onGraphChange: (g: Graph) => void;
};

export default function AgentMcpAttach({ graph, agentId, onGraphChange }: Props) {
  const servers = listMcpServers(graph);
  const selected = new Set(getAgentAttachedServers(graph, agentId));

  const toggle = (sid: string) => {
    const next = new Set(selected);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    onGraphChange(setAgentAttachedServers(graph, agentId, Array.from(next)));
  };

  if (!servers.length) return <div className="text-sm opacity-60 p-2">No MCP servers in this graph yet.</div>;

  return (
    <div className="space-y-2 p-2">
      <div className="text-xs uppercase opacity-70">Attach MCP servers</div>
      {servers.map(s => (
        <label key={s.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
          <span>{s.label}</span>
          <span className="opacity-60 text-xs ml-auto">{s.data.protocol}</span>
        </label>
      ))}
    </div>
  );
}
```

> Integrate this panel into your existing **Inspector** when an `agent.codeless` node is selected (e.g., a “MCP” tab next to **Tools**).

---

## Tests

`mcp.ir.spec.ts`
- **Create**: start with minimal graph; `upsertMcpServer` should add a `mcpServer` node with defaults.  
- **Update**: call `upsertMcpServer` with same id; ensure values are replaced.  
- **Attach**: `setAgentAttachedServers(graph, agentId, [sid])` should create edges and no duplicates; `getAgentAttachedServers` returns ids.  
- **Remove**: `removeMcpServer` deletes node and any edges referencing it.

`mcp.panels.spec.tsx`
- Render `McpServerPanel`, set URL/auth/namespace filter, click **Save**; expect `onGraphChange` with new server node.  
- Render `AgentMcpAttach` with two servers, toggle checkboxes, assert edges in `onGraphChange` payload.

Keep tests deterministic; no network.

---

## Acceptance Criteria
- Users can **create, edit, and delete** MCP server nodes with URL, protocol, auth, capabilities, and namespace filter.  
- Users can **attach servers** to an `agent.codeless` via edges; export IR includes both nodes and edges consistent with your schema.  
- Only **secret references** are stored client‑side; no credentials.  
- TypeScript strict mode passes; unit tests for IR & panels pass; no heavy dependencies added.

---

## Validation (manual)
1) Create an MCP server node (“OneDrive MCP”), set protocol `mcp/1.0`, auth `client_credentials`, `secretRef=secrets/onedrive-cc`, namespace filter `["Documents","Shared"]`.  
2) Select a codeless agent; open the **MCP** tab; attach the OneDrive server.  
3) Export IR; verify the `mcpServer` node and an edge from the agent to the server.  
4) Run a Test chat; confirm engine behavior uses the server (telemetry should show MCP calls if enabled).

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** isolate MCP node editing from agent attachment; each panel does one job.  
- **Types everywhere:** IR helpers typed; editor props typed; avoid `any` at boundaries.  
- **Minimal deps:** no schema form libs; use simple typed inputs.  
- **Performance:** no deep clones of the whole graph on every keystroke; only update on **Save**.  
- **Security:** never store secrets; only **secretRef** strings.  
- **A11y:** labeled inputs, keyboard focus order, checkbox roles correct.  
- **Config:** protocol/auth dropdowns come from small constants; not hardcoded strings in multiple places.  
- **Errors:** basic front‑end validation (URL non‑empty, protocol present); show inline messages.  
- **Tests:** deterministic IR round‑trip; panel behavior; no network.  
- **Extensibility:** adding a new server requires no code changes beyond the editor view model (same node kind).
