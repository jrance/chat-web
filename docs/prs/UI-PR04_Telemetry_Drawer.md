
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR04 — Telemetry Drawer (basic/verbose): timeline + raw inspector

## Summary
Add a developer‑focused **Telemetry Drawer** to the Test panel that displays engine telemetry when the request header `X-Telemetry` is set to `basic` or `verbose`. The drawer renders a **timeline** (LLM/tool/MCP events, router decisions, checkpoints, usage) and a **Raw** inspector for the last N events.

This PR parses `telemetry.*` events that may be **interleaved on the main Responses stream**. It also supports an optional **secondary stream** if the engine advertises a channel token in an event (see “Dual‑channel fallback” below).

> Scope: parse + store telemetry events, UI drawer with Timeline & Raw tabs, headers plumbed from the Test UI. No backend changes required.

---

## Purpose
- Give reviewers live visibility into inputs/outputs, timings, and routing decisions.
- Keep it safe: PII‑redacted fields are labeled; verbose shows payload samples when provided by the engine.
- Remain engine‑agnostic: tolerate extra fields; only rely on the `type` prefix `telemetry.`.

---

## Files to Add / Change

```
src/
  lib/
    orch/
      telemetry.ts               # Types + normalizers for telemetry rows
  features/
    test-panel/
      hooks/
        useResponsesStream.ts    # CHANGE: capture telemetry.* events into state
      components/
        TelemetryDrawer.tsx      # NEW: timeline + raw tabs
        TestChatPane.tsx         # CHANGE: add Telemetry toggle & mount drawer
__tests__/
  telemetry.parser.spec.ts       # NEW: parse & normalize events
  telemetry.drawer.spec.tsx      # NEW: render timeline; raw inspector
```

---

## Event model

The engine emits telemetry events interleaved on the main stream when `X-Telemetry != "none"`.

**Recognized shapes (tolerant to extras):**

```ts
export type TelemetryEvent =
  | { type: "telemetry.llm_input"; at?: number; agent?: string; model?: string; prompt?: string; tokens_est?: number; redacted?: boolean }
  | { type: "telemetry.llm_output"; at?: number; agent?: string; model?: string; text_sample?: string; tokens?: { input?: number; output?: number; total?: number } }
  | { type: "telemetry.tool_call"; at?: number; agent?: string; name: string; args?: any; call_id?: string; redacted?: boolean }
  | { type: "telemetry.tool_result"; at?: number; agent?: string; name: string; result?: any; call_id?: string; error?: { code: string; message: string } }
  | { type: "telemetry.router_decision"; at?: number; agent?: string; target: string; confidence?: number; rationale?: string }
  | { type: "telemetry.checkpoint"; at?: number; agent?: string; kind?: string; id?: string }
  | { type: "telemetry.usage"; at?: number; agent?: string; tokens?: { input?: number; output?: number; total?: number }; cost?: number }
  | { type: "telemetry.warning"; at?: number; agent?: string; message: string }
  | { type: "telemetry.error"; at?: number; agent?: string; message: string; code?: string };
```

**Dual‑channel fallback (optional):**
If the engine emits `{ type:"telemetry.channel", url?: string, token?: string }`, the UI **may** open a second stream at `url` or `GET /v1/execute/stream?channel=<token>` and feed those events through the same parser. This is optional; implement the parser hooks now and leave the fetch for later once the backend advertises it.

---

## Implementation

### 1) Types & normalizer (`src/lib/orch/telemetry.ts`)

```ts
export type TelemetryRow = {
  id: string;
  at: number;                 // timestamp (ms)
  agent?: string;
  kind:
    | "llm_input" | "llm_output"
    | "tool_call" | "tool_result"
    | "router_decision" | "checkpoint"
    | "usage" | "warning" | "error";
  title: string;              // short label for timeline
  details?: any;              // safe JSON-ish blob for Raw
  severity?: "info" | "warn" | "error";
};

export function toRow(evt: any): TelemetryRow | null {
  if (!evt?.type?.startsWith?.("telemetry.")) return null;
  const t = evt.type.slice("telemetry.".length);
  const base = {
    id: crypto.randomUUID?.() ?? String(Math.random()),
    at: evt.at ?? Date.now(),
    agent: evt.agent,
  };
  switch (t) {
    case "llm_input":
      return { ...base, kind: "llm_input", title: `LLM in (${evt.model ?? "model"})`, details: pick(evt, ["prompt","tokens_est","redacted","model"]) };
    case "llm_output":
      return { ...base, kind: "llm_output", title: `LLM out (${evt.model ?? "model"})`, details: pick(evt, ["text_sample","tokens","model"]) };
    case "tool_call":
      return { ...base, kind: "tool_call", title: `Tool call: ${evt.name}`, details: pick(evt, ["name","args","call_id","redacted"]) };
    case "tool_result":
      return { ...base, kind: "tool_result", title: `Tool result: ${evt.name}`, details: pick(evt, ["name","result","call_id","error"]) };
    case "router_decision":
      return { ...base, kind: "router_decision", title: `Router → ${evt.target}`, details: pick(evt, ["target","confidence","rationale"]) };
    case "checkpoint":
      return { ...base, kind: "checkpoint", title: `Checkpoint ${evt.kind ?? ""}`.trim(), details: pick(evt, ["kind","id"]) };
    case "usage":
      return { ...base, kind: "usage", title: "Usage", details: pick(evt, ["tokens","cost"]) };
    case "warning":
      return { ...base, kind: "warning", title: "Warning", details: pick(evt, ["message"]), severity: "warn" };
    case "error":
      return { ...base, kind: "error", title: "Error", details: pick(evt, ["message","code"]), severity: "error" };
    default:
      return null;
  }
}

// tiny helper
function pick(obj:any, keys:string[]) {
  const out:any = {};
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k]=obj[k];
  return out;
}
```

### 2) Hook changes (`src/features/test-panel/hooks/useResponsesStream.ts`)

Add telemetry state and capture in the same streaming loop you already have (UI‑PR01a).

```ts
// new state
const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);

// inside stream loops (send() & resume()): after parsing evt
import { toRow, TelemetryRow } from "../../../lib/orch/telemetry";

const row = toRow(evt);
if (row) {
  setTelemetry(prev => {
    const next = [...prev, row];
    // clamp to last 300 for safety
    if (next.length > 300) next.splice(0, next.length - 300);
    return next;
  });
}
```

Expose `telemetry` from the hook:

```ts
return useMemo(() => ({
  runId: runIdRef.current,
  messages, status, usage, error, hitl,
  telemetry,
  send, resume, cancel,
}), [messages, status, usage, error, hitl, telemetry, send, resume, cancel]);
```

### 3) Telemetry Drawer component (`src/features/test-panel/components/TelemetryDrawer.tsx`)

```tsx
import { useMemo, useState } from "react";
import type { TelemetryRow } from "../../../lib/orch/telemetry";

export default function TelemetryDrawer({ rows }: { rows: TelemetryRow[] }) {
  const [tab, setTab] = useState<"timeline"|"raw">("timeline");
  const latest = useMemo(() => rows.slice(-200), [rows]); // bound size

  return (
    <div className="border-l border-neutral-800 bg-neutral-950 w-96 flex flex-col">
      <div className="flex items-center border-b border-neutral-800">
        <button onClick={() => setTab("timeline")} className={`px-3 py-2 text-sm ${tab==="timeline"?"text-white":"text-neutral-400"}`}>Timeline</button>
        <button onClick={() => setTab("raw")} className={`px-3 py-2 text-sm ${tab==="raw"?"text-white":"text-neutral-400"}`}>Raw</button>
        <div className="ml-auto px-3 text-xs opacity-60">{latest.length}</div>
      </div>

      {tab === "timeline" ? (
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {latest.map((r) => (
            <div key={r.id} className="rounded border border-neutral-800 p-2 bg-neutral-900/40">
              <div className="text-xs opacity-60">{new Date(r.at).toLocaleTimeString()}</div>
              <div className="text-sm">
                <span className={r.severity==="error"?"text-red-400": r.severity==="warn"?"text-yellow-300":"text-neutral-100"}>
                  {r.title}
                </span>
                {r.agent && <span className="opacity-60"> — {r.agent}</span>}
              </div>
              {r.details && (
                <pre className="mt-1 text-xs opacity-80 overflow-auto max-h-40">
                  {JSON.stringify(r.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-2">
          <pre className="text-xs">{JSON.stringify(latest, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### 4) Wire into TestChatPane (`src/features/test-panel/components/TestChatPane.tsx`)

Add a telemetry toggle (header) and mount the drawer when not `"none"`.

```tsx
// add UI state
const [telemetryLevel, setTelemetryLevel] = useState<"none"|"basic"|"verbose">("none");

// when sending/resuming:
const headers = {
  Authorization: `Bearer ${authToken}`,
  "X-Tenant-ID": tenantId,
  "X-Request-ID": crypto.randomUUID(),
  "X-Correlation-ID": crypto.randomUUID(),
  "X-Telemetry": telemetryLevel,
};

// top bar toggle example (adapt to your header area)
<div className="flex items-center gap-2 p-2 border-b border-neutral-800">
  <label className="text-xs opacity-70">Telemetry</label>
  <select className="bg-neutral-900 text-neutral-50 text-xs rounded px-2 py-1"
          value={telemetryLevel} onChange={e=>setTelemetryLevel(e.target.value as any)}>
    <option value="none">none</option>
    <option value="basic">basic</option>
    <option value="verbose">verbose</option>
  </select>
</div>

// layout: put drawer on the right
<div className="flex h-full">
  <div className="flex-1 flex flex-col"> ...existing chat... </div>
  {telemetryLevel !== "none" && <TelemetryDrawer rows={telemetry} />}
</div>
```

> The `telemetry` array comes from the hook update in step 2.

---

## Tests

`telemetry.parser.spec.ts`
- Feed sample `telemetry.*` events and assert `toRow()` normalization.
- Ensure unknown types return `null`.
- Clamp behavior: pushing >300 rows retains only the last 300.

`telemetry.drawer.spec.tsx`
- Render a few rows; assert title, agent, timestamp formatting; Raw tab shows full JSON.
- Snapshot basic timeline structure (keep shallow).

Also update any hook tests to assert that when `telemetry.*` events arrive, `telemetry` grows accordingly.

---

## Acceptance Criteria
- When `X-Telemetry` is `basic` or `verbose`, the drawer shows a live timeline of events (LLM/tool/router/checkpoints/usage), with Raw JSON available.
- The UI stays responsive (no noticeable lag with 200–300 rows).
- No new heavy runtime deps; TypeScript remains strict; tests are deterministic and pass.
- If the engine emits `telemetry.channel`, the client **ignores** it for now (no error) — we’ll enable dual‑channel later without FE churn.

---

## Validation (manual)
1) Start the engine and set Test panel Telemetry to **basic**. Send a prompt that triggers a tool and a router. Verify timeline entries.  
2) Switch to **verbose**; confirm payload samples appear in the Raw tab.  
3) Toggle **none** mid‑session; drawer hides; no crashes.  
4) Confirm no performance degradation after a long run (stream a few hundred events).

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** parser logic isolated; UI components small and focused.  
- **Async correctness:** telemetry capture happens in the same guarded loop as Responses; no races.  
- **Minimal deps:** platform APIs, no chart libs; pure React + TypeScript.  
- **Performance:** bound list size; avoid re‑creating arrays in tight loops; memoize derived values.  
- **Security:** render JSON as text; never eval or inject HTML; honor back‑end redaction signals.  
- **A11y:** keyboard focus doesn’t jump when the drawer opens; tabs are reachable; high contrast.  
- **Config:** telemetry level wired via header; no magic globals.  
- **Errors:** parser is tolerant; unknown telemetry is ignored, not fatal.  
- **Tests:** deterministic; no network; validate both normalization and rendering.  
- **Extensibility:** new `telemetry.*` types map via `toRow()` without UI rewrites.
