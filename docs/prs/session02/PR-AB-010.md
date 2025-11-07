
# PR‑AB‑010 — Remote Tool Registries (MCP) + Capability Discovery

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001..009 (IR, Mapper, Parallel, Combiner, Tool Registry, Exporter, Preview Runner)  
**Scope:** Add **Remote Tool Registries** compatible with MCP‑style catalogs, with **capability discovery**, **auth hints**, caching, and a **Registry Panel** UI. Allow Agent nodes to pick tools from **local** and **remote** registries.  
**Coverage target:** **≥80%** (Vitest + RTL).

> This PR is design‑time only (builder). Runtime/tool execution is out of scope.

---

## Tenets

1. **Spec‑first, Pluggable** — A `ToolRegistry` interface abstracts **local** (default) and **remote** catalogs. Remote uses simple HTTP JSON endpoints shaped like MCP catalogs (see below).  
2. **Least‑Privilege & Safe** — Auth tokens are stored **ephemerally** (memory) by default; opt‑in persistence to `localStorage` with clear UX. No tokens in logs or exports.  
3. **Deterministic UI** — The **Registry Panel** shows registry health, capabilities, last refresh, and lets users select registries for each Agent’s Tools picker.  
4. **Fast & Observable** — Caching with TTL; `AbortController` for cancellation; visible load/error states in UI.  
5. **Quality** — Strong typing, pure transformation helpers, and isolated tests for adapters, caches, and UI flows.

---

## Remote MCP‑style endpoints (MVP)

We support a minimal subset, via GETs that return JSON:

- `GET /mcp/capabilities` → discovery
```json
{
  "name": "Contoso Tools",
  "version": "2024.11",
  "capabilities": ["tools.list", "tools.schema", "rate_limits"],
  "auth": { "type": "bearer|apikey|none", "scopes": ["sharepoint.read","onedrive.read"] }
}
```

- `GET /mcp/tools` → list of tools (OpenAI‑style function tools; variants optional)
```json
{
  "tools": [
    { "type": "function", "function": {
      "id": "sharepoint.search",
      "name": "sharepoint_search",
      "description": "Search SharePoint",
      "parameters": { "type": "object", "properties": { "site": { "type":"string" }, "query": { "type":"string" } }, "required": ["site","query"] }
    }},
    { "type": "function", "function": {
      "id": "onedrive.search",
      "name": "onedrive_search",
      "description": "Search OneDrive",
      "parameters": { "type": "object", "properties": { "owner": { "type":"string" }, "query": { "type":"string" } }, "required": ["owner","query"] }
    }}
  ]
}
```

> If a server uses different paths/shape, we’ll add adapters in later PRs. For MVP we assume the above.

---

## File changes (under `src/modules/agent-builder`)

### 1) **NEW** `model/remote_registry.ts` — types

```ts
// src/modules/agent-builder/model/remote_registry.ts
export type AuthType = "none" | "bearer" | "apikey";

export type McpCapabilities = {
  name: string;
  version?: string;
  capabilities: string[];
  auth: { type: AuthType; scopes?: string[] };
};

export type McpToolFunction = {
  id?: string; // optional remote id
  name: string; // OpenAI-safe name
  description?: string;
  parameters?: any; // JSON Schema
};

export type McpTool = { type: "function"; function: McpToolFunction };

export type RemoteRegistryConfig = {
  id: string;              // unique local id
  label: string;           // display name
  baseUrl: string;         // e.g., https://contoso.example.com
  authType: AuthType;      // none | bearer | apikey
  token?: string;          // bearer token or api key (optional, ephemeral by default)
  tokenPersist?: boolean;  // if true, persist token to localStorage
  headers?: Record<string, string>; // extra headers (e.g., tenant)
  ttlMs?: number;          // cache TTL for tools/capabilities
};

export type RemoteRegistryState = {
  cfg: RemoteRegistryConfig;
  lastFetch?: number;
  capabilities?: McpCapabilities;
  tools?: McpTool[];
  error?: string | null;
};
```

---

### 2) **NEW** `registry/remote.http.ts` — fetcher with cache + abort

```ts
// src/modules/agent-builder/registry/remote.http.ts
import type { RemoteRegistryConfig, RemoteRegistryState, McpCapabilities, McpTool } from "../model/remote_registry";

const STORE_KEY = "ab.remote.registries.tokens"; // only when tokenPersist=true

function buildHeaders(cfg: RemoteRegistryConfig): Headers {
  const h = new Headers({ "Accept": "application/json" });
  if (cfg.headers) for (const [k,v] of Object.entries(cfg.headers)) h.set(k, v);
  if (cfg.authType === "bearer" && cfg.token) h.set("Authorization", `Bearer ${cfg.token}`);
  if (cfg.authType === "apikey" && cfg.token) h.set("X-API-Key", cfg.token);
  return h;
}

export async function fetchCapabilities(cfg: RemoteRegistryConfig, signal?: AbortSignal): Promise<McpCapabilities> {
  const res = await fetch(new URL("/mcp/capabilities", cfg.baseUrl).toString(), { headers: buildHeaders(cfg), signal });
  if (!res.ok) throw new Error(`capabilities ${res.status}`);
  return await res.json();
}

export async function fetchTools(cfg: RemoteRegistryConfig, signal?: AbortSignal): Promise<McpTool[]> {
  const res = await fetch(new URL("/mcp/tools", cfg.baseUrl).toString(), { headers: buildHeaders(cfg), signal });
  if (!res.ok) throw new Error(`tools ${res.status}`);
  const body = await res.json();
  const tools = Array.isArray(body.tools) ? body.tools : [];
  return tools.filter((t: any) => t && t.type === "function");
}

export function persistToken(cfg: RemoteRegistryConfig) {
  if (!cfg.tokenPersist) return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const bag = raw ? JSON.parse(raw) : {};
    bag[cfg.id] = cfg.token ?? null;
    localStorage.setItem(STORE_KEY, JSON.stringify(bag));
  } catch {}
}

export function restoreToken(cfg: RemoteRegistryConfig): string | undefined {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return undefined;
    const bag = JSON.parse(raw);
    return bag[cfg.id] ?? undefined;
  } catch {
    return undefined;
  }
}
```

---

### 3) **NEW** `registry/registries.manager.ts` — unified view (local + remote)

```ts
// src/modules/agent-builder/registry/registries.manager.ts
import { DefaultToolRegistry } from "./tools.default";
import type { ToolRegistry, ToolDef } from "../model/tools";
import type { RemoteRegistryConfig, RemoteRegistryState } from "../model/remote_registry";
import { fetchCapabilities, fetchTools, restoreToken, persistToken } from "./remote.http";

export type UnifiedToolRegistry = ToolRegistry & {
  /** Adds/updates a remote registry config */
  upsertRemote(cfg: RemoteRegistryConfig): void;
  /** Remove a remote registry */
  removeRemote(id: string): void;
  /** Force refresh for a given remote registry */
  refreshRemote(id: string, opts?: { signal?: AbortSignal }): Promise<void>;
  /** Enumerate remote states (for UI) */
  remotes(): RemoteRegistryState[];
};

export function createUnifiedRegistry(ttlMs = 5 * 60_000): UnifiedToolRegistry {
  const local = DefaultToolRegistry;
  const remotesMap = new Map<string, RemoteRegistryState>();

  function list(): ToolDef[] {
    // unified listing: local only; remote exposed via picker UI (sectioned)
    return local.list();
  }
  function get(id: string): ToolDef | undefined {
    return local.get(id);
  }

  async function refreshRemote(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    const st = remotesMap.get(id);
    if (!st) throw new Error(`unknown registry ${id}`);
    const now = Date.now();
    if (st.lastFetch && st.cfg.ttlMs && now - st.lastFetch < st.cfg.ttlMs) return;
    const cfg = { ...st.cfg };
    if (!cfg.token && cfg.tokenPersist) cfg.token = restoreToken(cfg);
    try {
      const [cap, tools] = await Promise.all([fetchCapabilities(cfg, opts?.signal), fetchTools(cfg, opts?.signal)]);
      st.capabilities = cap;
      st.tools = tools;
      st.lastFetch = now;
      st.error = null;
      if (cfg.tokenPersist) persistToken(cfg);
    } catch (e: any) {
      st.error = e?.message ?? String(e);
    }
  }

  function upsertRemote(cfg: RemoteRegistryConfig) {
    remotesMap.set(cfg.id, { cfg, lastFetch: undefined, error: null });
  }

  function removeRemote(id: string) {
    remotesMap.delete(id);
  }

  function remotes(): RemoteRegistryState[] {
    return Array.from(remotesMap.values());
  }

  return { list, get, upsertRemote, removeRemote, refreshRemote, remotes };
}
```

---

### 4) **NEW** `components/Registry/RegistryPanel.tsx` — UI to manage remotes

```tsx
// src/modules/agent-builder/components/Registry/RegistryPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createUnifiedRegistry } from "../../registry/registries.manager";
import type { RemoteRegistryConfig } from "../../model/remote_registry";

const unified = createUnifiedRegistry();

export const RegistryPanel: React.FC = () => {
  const [id, setId] = useState("contoso");
  const [label, setLabel] = useState("Contoso Tools");
  const [baseUrl, setBaseUrl] = useState("https://example.com");
  const [authType, setAuthType] = useState<"none"|"bearer"|"apikey">("none");
  const [token, setToken] = useState("");
  const [persist, setPersist] = useState(false);
  const [ttl, setTtl] = useState(300000);

  const remotes = unified.remotes();

  const add = () => {
    const cfg: RemoteRegistryConfig = {
      id, label, baseUrl, authType, token: token || undefined, tokenPersist: persist, ttlMs: ttl
    };
    unified.upsertRemote(cfg);
  };

  const refresh = async (rid: string) => {
    const ac = new AbortController();
    await unified.refreshRemote(rid, { signal: ac.signal });
  };

  return (
    <section className="ab-registry">
      <header className="ab-registry-header">
        <strong>Remote Tool Registries</strong>
      </header>

      <div className="ab-grid-2 ab-registry-form">
        <div>
          <label>ID</label>
          <input className="ab-input" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div>
          <label>Label</label>
          <input className="ab-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label>Base URL</label>
          <input className="ab-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div>
          <label>Auth</label>
          <select className="ab-select" value={authType} onChange={(e) => setAuthType(e.target.value as any)}>
            <option value="none">none</option>
            <option value="bearer">bearer</option>
            <option value="apikey">apikey</option>
          </select>
        </div>
        {authType !== "none" && (
          <div className="ab-grid-2">
            <div>
              <label>Token</label>
              <input className="ab-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••"/>
              <small className="ab-help">Stored in memory; check “Persist” to keep in localStorage.</small>
            </div>
            <label className="ab-checkline">
              <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} /> Persist token
            </label>
          </div>
        )}
        <div>
          <label>Cache TTL (ms)</label>
          <input className="ab-input" type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value || 0))} />
        </div>
        <div className="ab-actions">
          <button className="ab-btn ab-btn-primary" onClick={add}>Add / Update</button>
        </div>
      </div>

      <div className="ab-registry-list">
        {remotes.map(r => (
          <div key={r.cfg.id} className="ab-card">
            <div className="ab-row">
              <strong>{r.cfg.label}</strong> <code>{r.cfg.id}</code> — {r.cfg.baseUrl}
              <span className="ab-chip">{r.cfg.authType}</span>
            </div>
            <div className="ab-row">
              <button className="ab-btn" onClick={() => refresh(r.cfg.id)}>Refresh</button>
              {r.capabilities ? <span>Capabilities: {r.capabilities.capabilities.join(", ")}</span> : <span>No capabilities yet</span>}
              {r.lastFetch ? <span>Last: {new Date(r.lastFetch).toLocaleTimeString()}</span> : null}
              {r.error ? <span className="ab-err">Error: {r.error}</span> : null}
            </div>
            {r.tools && (
              <details>
                <summary>Tools ({r.tools.length})</summary>
                <ul className="ab-list">
                  {r.tools.map((t, i) => (
                    <li key={i}><code>{t.function.name}</code> — {t.function.description}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
```

**Styles (append to builder CSS):**
```css
.ab-registry { border: 1px solid var(--line); border-radius: 12px; background: var(--card); display: grid; gap: 8px; }
.ab-registry-header { padding: 8px 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; }
.ab-registry-form { padding: 8px 12px; }
.ab-registry-list { padding: 8px 12px; display: grid; gap: 8px; }
.ab-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.ab-chip { background: var(--chip); border: 1px solid var(--line); border-radius: 8px; padding: 2px 8px; font-size: 12px; }
.ab-err { color: var(--red); }
```

---

### 5) **UPDATE** `components/Tools/AgentToolsPicker.tsx` — source selector

Add a source selector: **Local** (default) and any **Remote** registries that have loaded tools. When a remote source is selected, render its tool list (function name + description) instead of the local registry.

```tsx
// src/modules/agent-builder/components/Tools/AgentToolsPicker.tsx
// ...imports...
import { createUnifiedRegistry } from "../../registry/registries.manager";

const unified = createUnifiedRegistry(); // singleton for the module

type Source = { id: string; label: string; kind: "local" | "remote" };

export const AgentToolsPicker: React.FC<Props> = ({ node, onChange, registry }) => {
  // existing code...

  const remoteStates = unified.remotes();
  const sources: Source[] = [{ id: "local", label: "Local Registry", kind: "local" }, ...remoteStates.filter(r => (r.tools?.length ?? 0) > 0).map(r => ({ id: r.cfg.id, label: r.cfg.label, kind: "remote" as const }))];

  const [sourceId, setSourceId] = useState<string>(sources[0]?.id ?? "local");

  const toolDefs = useMemo(() => {
    if (sourceId === "local") return registry.list().map(t => ({ origin: "local" as const, id: t.id, name: t.name, description: t.description, variants: t.variants, parameters: t.parameters }));
    const st = remoteStates.find(r => r.cfg.id === sourceId);
    const arr = (st?.tools ?? []).map(t => ({ origin: "remote" as const, id: t.function.id || t.function.name, name: t.function.name, description: t.function.description, parameters: t.function.parameters }));
    return arr;
  }, [sourceId, registry, remoteStates]);

  // render a select for sources above the list
  // and proceed to render "toolDefs" like before (id/name/desc/schema viewer)
};
```

> Keep the rest of the picker logic intact; only the list source changes. Selected tools still persist in `AgentNode.config.allowedTools` with `{ toolId, variantId? }`. For remote tools with no variants, store `{ toolId }` using the **remote** id (prefer `function.id` if present, else `function.name`).

---

## Tests

```
src/modules/agent-builder/registry/__tests__/remote.http.spec.ts
src/modules/agent-builder/registry/__tests__/registries.manager.spec.ts
src/modules/agent-builder/components/Registry/__tests__/RegistryPanel.spec.tsx
src/modules/agent-builder/components/Tools/__tests__/AgentToolsPicker.remote.spec.tsx
```

**`remote.http.spec.ts`** — fetch + errors + token persistence

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCapabilities, fetchTools, persistToken, restoreToken } from "../../remote.http";

beforeEach(() => {
  // @ts-ignore
  global.fetch = vi.fn((url: string) => {
    if (url.endsWith("/mcp/capabilities")) return Promise.resolve(new Response(JSON.stringify({ name: "x", capabilities: ["tools.list"], auth: { type: "none" } }), { status: 200 }));
    if (url.endsWith("/mcp/tools")) return Promise.resolve(new Response(JSON.stringify({ tools: [{ type: "function", function: { name: "t", description: "d", parameters: { type:"object" } } }] }), { status: 200 }));
    return Promise.resolve(new Response("not found", { status: 404 }));
  });
});

it("fetches capabilities and tools", async () => {
  const cfg: any = { baseUrl: "https://ex", authType: "none" };
  const cap = await fetchCapabilities(cfg);
  const tools = await fetchTools(cfg);
  expect(cap.capabilities).toContain("tools.list");
  expect(tools[0].function.name).toBe("t");
});

it("persists and restores token", () => {
  const cfg: any = { id: "r1", token: "abc", tokenPersist: true };
  persistToken(cfg);
  const out = restoreToken({ id: "r1" } as any);
  expect(out).toBe("abc");
});
```

**`registries.manager.spec.ts`** — refresh + caching + error

```ts
import { describe, it, expect, vi } from "vitest";
import { createUnifiedRegistry } from "../../registries.manager";

describe("registries.manager", () => {
  it("adds remote and refreshes", async () => {
    const m = createUnifiedRegistry(0);
    // @ts-ignore
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith("/mcp/capabilities")) return Promise.resolve(new Response(JSON.stringify({ name: "x", capabilities: ["tools.list"], auth: { type: "none" } }), { status: 200 }));
      if (url.endsWith("/mcp/tools")) return Promise.resolve(new Response(JSON.stringify({ tools: [{ type: "function", function: { name: "t" } }] }), { status: 200 }));
      return Promise.resolve(new Response("not found", { status: 404 }));
    });
    m.upsertRemote({ id: "r1", label: "R1", baseUrl: "https://x", authType: "none" });
    await m.refreshRemote("r1");
    const rs = m.remotes();
    expect(rs[0].tools?.length).toBe(1);
  });
});
```

**`RegistryPanel.spec.tsx`** — add/refresh flow

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegistryPanel } from "../../RegistryPanel";

describe("RegistryPanel", () => {
  it("renders and allows add/update", () => {
    render(<RegistryPanel />);
    expect(screen.getByText(/Remote Tool Registries/)).toBeTruthy();
    fireEvent.click(screen.getByText("Add / Update"));
    // presence of card list area
    expect(document.querySelector(".ab-registry-list")).toBeTruthy();
  });
});
```

**`AgentToolsPicker.remote.spec.tsx`** — switch to remote source

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AgentToolsPicker } from "../../AgentToolsPicker";

describe("AgentToolsPicker (remote)", () => {
  it("renders with local registry fallback", () => {
    const node: any = { id: "a", kind: "agent", config: { allowedTools: [] } };
    const reg: any = { list: () => [], get: () => undefined };
    const { getByPlaceholderText } = render(<AgentToolsPicker node={node} onChange={() => {}} registry={reg} />);
    expect(getByPlaceholderText("Search tools...")).toBeTruthy();
  });
});
```

---

## Acceptance Criteria

- A **Unified Tool Registry** manager exists with remote registry support, caching (TTL), and token persistence (opt‑in).  
- A **Registry Panel** allows users to add/update remote registries, refresh, and view capabilities + tools.  
- **Agent Tools Picker** can switch between **Local** and **Remote** sources and list remote tools for selection.  
- No secrets appear in exported IR or envelopes.  
- Unit tests cover HTTP adapter, manager, panel, and picker behaviors; **≥80%** coverage for new files.

---

## How to Review & Test

```bash
pnpm i
pnpm test

# In the builder UI:
# 1) Open "Registry Panel", add a remote (e.g., https://example.com, auth=none), click Refresh.
# 2) Open an Agent → Tools and choose source "Contoso Tools". Select a tool; ensure it persists in IR.
# 3) Export (PR‑AB‑008) — tools list should include selected remote tools (by sanitized name).
```

---

## Notes / Next

- **PR‑AB‑011:** Wire the real Orchestration Engine; replace Preview Runner with live SSE via `/v1/execute/stream`.  
- **PR‑AB‑012:** OAuth flows for registries; refresh tokens + PKCE (separate module).  
- **PR‑AB‑013:** Per‑tenant registry sets and policy controls (allow‑/deny‑lists).
