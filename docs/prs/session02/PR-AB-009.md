
# PR‑AB‑009 — Preview Runner with Mock Tools & Simulated SSE

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001..008 (IR, Mapper, Parallel Items/Branches, Combiner, Tool Registry, Exporter)  
**Scope:** Add a **Preview Runner** that executes the exported **Engine Request Envelope** **locally in the browser** with **mock tools** and **simulated OpenAI Responses‑style SSE**. This validates orchestration UX (fan‑out/in, broadcast, combiner) before wiring the real server.  
**Coverage target:** **≥80%** (Vitest + React Testing Library).

---

## Tenets

1. **Spec‑first SSE** — Emit events that mirror **OpenAI Responses** stream (e.g., `response.created`, `response.output_text.delta`, `response.tool_call.created|delta|done`, `response.tool_result.created|done`, `response.completed`).  
2. **Deterministic & Fast** — Runs entirely in the client; “LLM” is a mock generator and “tools” are canned responders. The parallelism is simulated but deterministic per step.  
3. **Debuggable** — Includes an **SSE Console** (raw events) and a **Transcript View** that assembles `output_text` and tool calls the same way the UI will later.  
4. **Composable** — The runner consumes the **ExecuteEnvelope** produced in PR‑AB‑008. No direct coupling to canvas state.  
5. **Safe** — No network calls; tool mocks are sandboxed; no eval of user text.

---

## What it does (MVP)

- Accept an **ExecuteEnvelope** (graph + tools + input) and **run** it:
  - `entry.form` seeds messages/form/files.
  - `parallel.items` dispatch loop uses **the same math** as PR‑AB‑005 (bounded concurrency), but emits **SSE events** whenever “workers” (mock agents) start/finish.
  - `parallel.branches` broadcasts to child agents and **fans in** child results as `evidence[]` with `list_concat` behavior.
  - **Agent nodes** (LLM) use a **mock LLM** that emits `response.output_text.delta` chunks and produces a short “assistant” message based on inputs and mock tool results.
  - **Tool calls** are mocked based on the Tool Registry id; you can provide **per‑tool canned outputs** in the runner config.
  - **Combiner agent** gets `evidence[]` and emits a summary string (mock) via streamed deltas.
- The UI shows:
  - **Run Controls**: Start, Pause, Step, Reset.
  - **SSE Console**: event name + compact JSON payload per line, filterable.
  - **Transcript**: a running view of assistant text and tool calls.
  - **Metrics**: inflight/completed for `parallel.items` if used.

> This is a design‑time preview; the real engine will replace it but emit the same SSE envelopes.

---

## File changes (under `src/modules/agent-builder`)

### 1) **NEW** `preview/types.ts` — event & runner types

```ts
// src/modules/agent-builder/preview/types.ts
import type { ExecuteEnvelope } from "../exporter/request_envelope";

export type SseEvent =
  | { event: "response.created"; data: { id: string; model?: string } }
  | { event: "response.telemetry.delta"; data: { channel: "orchestrator" | "llm" | "tool"; message: string } }
  | { event: "response.tool_call.created"; data: { id: string; tool_name: string; call_index: number; arguments_delta?: string } }
  | { event: "response.tool_call.delta"; data: { id: string; call_index: number; arguments_delta: string } }
  | { event: "response.tool_call.done"; data: { id: string; call_index: number } }
  | { event: "response.tool_result.created"; data: { call_id: string; call_index: number } }
  | { event: "response.tool_result.done"; data: { call_id: string; call_index: number; output: any } }
  | { event: "response.output_text.delta"; data: { text: string } }
  | { event: "response.output_text.done"; data: { text: string } }
  | { event: "response.completed"; data: { id: string } }
  ;

export type RunnerConfig = {
  /** milliseconds between delta tokens (mock) */
  llmTokenDelayMs?: number;
  /** canned tool results by tool name (OpenAI-safe name) */
  toolResults?: Record<string, any>;
};

export type PreviewRun = {
  id: string;
  envelope: ExecuteEnvelope;
  config: RunnerConfig;
};
```

---

### 2) **NEW** `preview/mock_llm.ts` — token generator

```ts
// src/modules/agent-builder/preview/mock_llm.ts
import type { SseEvent } from "./types";

export function* streamAssistantText(text: string, tokenSize = 12): Generator<SseEvent> {
  for (let i = 0; i < text.length; i += tokenSize) {
    yield { event: "response.output_text.delta", data: { text: text.slice(i, i + tokenSize) } };
  }
  yield { event: "response.output_text.done", data: { text } };
}
```

---

### 3) **NEW** `preview/mock_tools.ts` — canned results by tool id

```ts
// src/modules/agent-builder/preview/mock_tools.ts
import type { SseEvent } from "./types";

// Convert registry id ("s3.get_object") to OpenAI-safe name ("s3_get_object")
export function safeToolName(id: string): string {
  return id.replace(/[^a-z0-9_\-]/gi, "_").slice(0, 64);
}

export function* runToolCall(toolId: string, callIndex: number, args: any, canned?: Record<string, any>): Generator<SseEvent> {
  const name = safeToolName(toolId);
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  yield { event: "response.tool_result.created", data: { call_id: callId, call_index: callIndex } };
  const output = canned && canned[name] !== undefined ? canned[name] : { ok: true, tool: name, args };
  yield { event: "response.tool_result.done", data: { call_id: callId, call_index: callIndex, output } };
}
```

---

### 4) **NEW** `preview/mapper_exec.ts` — runtime application of mappings

```ts
// src/modules/agent-builder/preview/mapper_exec.ts
import type { EdgeMapping } from "../model/ir";
import { applyEdgeMappings } from "../lib/mapper";

/** Apply mappings; always returns a plain object ({} on error). */
export function mapEdge(source: unknown, mappings: EdgeMapping[] | undefined): Record<string, unknown> {
  const r = applyEdgeMappings(source, mappings ?? []);
  if (!r.ok) return {};
  return r.value as Record<string, unknown>;
}
```

---

### 5) **NEW** `preview/runner.ts` — envelope interpreter (MVP)

```ts
// src/modules/agent-builder/preview/runner.ts
import type { ExecuteEnvelope } from "../exporter/request_envelope";
import type { SseEvent, RunnerConfig } from "./types";
import { streamAssistantText } from "./mock_llm";
import { runToolCall } from "./mock_tools";
import { mapEdge } from "./mapper_exec";

type EmitFn = (e: SseEvent) => void;

function getNode(g: ExecuteEnvelope["orchestration"], id: string) {
  return g.nodes[id];
}

function openaiNameFromTool(tool: any): string {
  return tool?.function?.name ?? "tool";
}

export async function runPreview(env: ExecuteEnvelope, cfg: RunnerConfig, emit: EmitFn) {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  emit({ event: "response.created", data: { id: runId, model: "mock-llm" } });

  // Seed payload from entry
  let payload: Record<string, any> = {
    messages: env.input.messages ?? [],
    context: { form: env.input.form ?? {}, files: env.input.files ?? [] }
  };

  // Helper: fan-out list_concat reducer
  function concatInto(target: Record<string, any>, key: string, vals: any[]) {
    if (!Array.isArray(target[key])) target[key] = [];
    target[key].push(...vals);
  }

  // A tiny work queue of node ids; in MVP we topologically attempt edges left-to-right
  // We only support a minimal set: entry.form -> (parallel.items | parallel.branches | agent)
  const g = env.orchestration;

  // Heuristic entry
  const entryId = g.entry ?? Object.keys(g.nodes)[0];
  let currentId = entryId;

  // Simple traversal: for each outgoing edge from currentId, drive the target
  // In MVP, we look at edges originating from the entry to decide the flow
  const outgoing = (nid: string) => g.edges.filter(e => e.from.nodeId === nid);

  // Process graph starting from entry
  for (const edge of outgoing(currentId)) {
    const target = getNode(g, edge.to.nodeId);
    const mapped = mapEdge({ ...payload }, edge.mappings ?? []);

    if (target.kind === "parallel.items") {
      const workerId = (target.config as any)?.workerId;
      const concurrency = (target.config as any)?.concurrency ?? 4;
      const items = (mapped as any).items ?? [];
      // bounded dispatch (synchronous simulation): chunks of size 'concurrency'
      let dispatched = 0;
      let evidence: any[] = [];
      while (dispatched < items.length) {
        const batch = items.slice(dispatched, dispatched + concurrency);
        emit({ event: "response.telemetry.delta", data: { channel: "orchestrator", message: `dispatch ${batch.length} items (inflight=${batch.length})` } });
        // For each item, simulate agent worker producing a small text and maybe a tool call
        let callIndex = 0;
        for (const row of batch) {
          // Simulate one tool call if any tools exist
          if (env.tools.length > 0) {
            const t0 = env.tools[0]; // first tool for demo
            const args = { row };
            emit({ event: "response.tool_call.created", data: { id: "tc", tool_name: openaiNameFromTool(t0), call_index: callIndex, arguments_delta: JSON.stringify(args).slice(0, 64) } });
            emit({ event: "response.tool_call.done", data: { id: "tc", call_index: callIndex } });
            for (const ev of runToolCall(t0.function.name, callIndex, args, cfg.toolResults)) emit(ev);
          }
          const text = `Validated row ${JSON.stringify(row).slice(0, 60)}`;
          for await (const ev of streamAssistantText(text)) emit(ev);
          evidence.push({ source: "worker", data: row, text });
          callIndex++;
        }
        dispatched += batch.length;
      }
      // Route parallel.results to next edges
      const resultsPayload = { evidence };
      for (const e2 of outgoing(target.id)) {
        const t2 = getNode(g, e2.to.nodeId);
        const mapped2 = mapEdge(resultsPayload, e2.mappings ?? []);
        if (t2.kind === "agent") {
          const summary = `Summary from ${evidence.length} items.`;
          for await (const ev of streamAssistantText(summary)) emit(ev);
        }
      }
    } else if (target.kind === "parallel.branches") {
      const children: string[] = (target.config as any)?.children ?? [];
      const broadcast: string[] = (target.config as any)?.broadcast ?? ["messages","context"];
      const evidence: any[] = [];
      emit({ event: "response.telemetry.delta", data: { channel: "orchestrator", message: `broadcast→${children.join(",")}` } });
      // For MVP, walk children sequentially but mark as parallel in telemetry
      let idx = 0;
      for (const cid of children) {
        emit({ event: "response.telemetry.delta", data: { channel: "orchestrator", message: `branch[${idx}] start ${cid}` } });
        // child receives broadcast payload
        const childInput: any = {};
        if (broadcast.includes("messages")) childInput.messages = payload.messages;
        if (broadcast.includes("context")) childInput.context = payload.context;
        // pretend child agent runs a tool and replies
        let callIndex = 0;
        if (env.tools.length > 0) {
          const t0 = env.tools[0];
          const args = { query: "demo" };
          emit({ event: "response.tool_call.created", data: { id: "tc", tool_name: openaiNameFromTool(t0), call_index: callIndex, arguments_delta: JSON.stringify(args) } });
          emit({ event: "response.tool_call.done", data: { id: "tc", call_index: callIndex } });
          for (const ev of runToolCall(t0.function.name, callIndex, args, cfg.toolResults)) emit(ev);
        }
        const text = `Child ${cid} produced evidence.`;
        for await (const ev of streamAssistantText(text)) emit(ev);
        evidence.push({ source: cid, text });
        idx++;
      }
      // fan-in to parent evidence
      const fanIn = { evidence };
      for (const e2 of outgoing(target.id)) {
        const t2 = getNode(g, e2.to.nodeId);
        const mapped2 = mapEdge(fanIn, e2.mappings ?? []);
        if (t2.kind === "agent") {
          const summary = `Combined ${evidence.length} branches.`;
          for await (const ev of streamAssistantText(summary)) emit(ev);
        }
      }
    } else if (target.kind === "agent") {
      const text = `Agent response for ${JSON.stringify(mapped).slice(0, 80)}`;
      for await (const ev of streamAssistantText(text)) emit(ev);
    }
  }

  emit({ event: "response.completed", data: { id: runId } });
}
```

---

### 6) **NEW** `components/Preview/PreviewPanel.tsx` — UI wrapper

```tsx
// src/modules/agent-builder/components/Preview/PreviewPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GraphDoc } from "../../model/ir";
import { DefaultToolRegistry } from "../../registry/tools.default";
import { buildExecuteEnvelope } from "../../exporter/request_envelope";
import { runPreview } from "../../preview/runner";
import type { SseEvent } from "../../preview/types";

type Props = { doc: GraphDoc; sampleInput?: any };

function useQueue<T>(initial: T[] = []) {
  const [list, setList] = useState<T[]>(initial);
  return {
    list,
    push: (x: T) => setList(L => [...L, x]),
    clear: () => setList([])
  };
}

export const PreviewPanel: React.FC<Props> = ({ doc, sampleInput }) => {
  const env = useMemo(() => buildExecuteEnvelope(doc, DefaultToolRegistry, sampleInput ?? {}), [doc, sampleInput]);
  const events = useQueue<SseEvent>();
  const [running, setRunning] = useState(false);

  const start = async () => {
    events.clear();
    setRunning(true);
    await runPreview(env, { toolResults: {} }, (e) => events.push(e));
    setRunning(false);
  };

  const assembled = useMemo(() => {
    // reconstruct assistant text
    let text = "";
    for (const e of events.list) {
      if (e.event === "response.output_text.delta") text += e.data.text;
    }
    return text;
  }, [events.list]);

  return (
    <section className="ab-preview">
      <header className="ab-preview-header">
        <strong>Preview Runner</strong>
        <button className="ab-btn ab-btn-primary" onClick={start} disabled={running}>{running ? "Running…" : "Start"}</button>
      </header>
      <div className="ab-grid-2">
        <div>
          <h4>SSE Console</h4>
          <div className="ab-console">
            {events.list.map((e, i) => (
              <div key={i} className="ab-logline">
                <span className="ab-evt">{e.event}</span>
                <code className="ab-json">{JSON.stringify(e.data)}</code>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4>Transcript (assembled)</h4>
          <pre className="ab-pre">{assembled}</pre>
        </div>
      </div>
    </section>
  );
};
```

**Styles (append to builder CSS):**
```css
.ab-preview { border: 1px solid var(--line); border-radius: 12px; background: var(--card); display: grid; gap: 8px; }
.ab-preview-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.ab-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 8px 12px; }
.ab-console { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px; height: 360px; overflow: auto; }
.ab-logline { display: grid; grid-template-columns: 220px 1fr; gap: 8px; font-family: var(--font-mono, monospace); font-size: 12px; padding: 2px 0; }
.ab-evt { opacity: 0.9; }
.ab-json { white-space: pre-wrap; word-break: break-word; }
```

---

## Tests

```
src/modules/agent-builder/preview/__tests__/mock_llm.spec.ts
src/modules/agent-builder/preview/__tests__/mock_tools.spec.ts
src/modules/agent-builder/preview/__tests__/runner.spec.ts
src/modules/agent-builder/components/Preview/__tests__/PreviewPanel.spec.tsx
```

**`mock_llm.spec.ts`** — deltas then done

```ts
import { describe, it, expect } from "vitest";
import { streamAssistantText } from "../../mock_llm";

describe("streamAssistantText", () => {
  it("yields deltas then done", () => {
    const out = Array.from(streamAssistantText("hello world", 5));
    const deltas = out.filter(e => e.event === "response.output_text.delta");
    const done = out.find(e => e.event === "response.output_text.done");
    expect(deltas.length).toBeGreaterThan(0);
    expect(done).toBeTruthy();
  });
});
```

**`mock_tools.spec.ts`** — result created/done

```ts
import { describe, it, expect } from "vitest";
import { runToolCall, safeToolName } from "../../mock_tools";

describe("mock_tools", () => {
  it("emits tool_result created and done", () => {
    const out = Array.from(runToolCall("s3.get_object", 0, { key: "x" }, { s3_get_object: { ok: true, id: "obj" } }));
    expect(out[0].event).toBe("response.tool_result.created");
    expect(out[1].event).toBe("response.tool_result.done");
  });
  it("sanitizes tool name", () => {
    expect(safeToolName("my.tool-1")).toBe("my_tool-1");
  });
});
```

**`runner.spec.ts`** — runs and completes

```ts
import { describe, it, expect } from "vitest";
import { runPreview } from "../../runner";

const env: any = {
  api: { version: "v1", sse: { format: "openai.responses" } },
  orchestration: {
    version: "eng-0.1",
    id: "g",
    name: "t",
    entry: "entry",
    nodes: {
      entry: { id: "entry", kind: "entry.form", outputs: [{ name: "form", schema: { type: "object" } }] },
      parallel: { id: "parallel", kind: "parallel.items", config: { concurrency: 2, workerId: "worker" } },
      worker: { id: "worker", kind: "agent", config: { model: "mock" } },
      comb: { id: "comb", kind: "agent", meta: { combiner: true }, inputs: [{ name: "evidence", schema: { type: "array" } }] }
    },
    edges: [
      { id: "e1", from: { nodeId: "entry", port: "form" }, to: { nodeId: "parallel", port: "items" }, mappings: [{ from: "$.form.rows[*]", to: "items", reduce: "list_concat" }] },
      { id: "e2", from: { nodeId: "parallel", port: "results" }, to: { nodeId: "comb", port: "evidence" }, mappings: [{ from: "$", to: "evidence", reduce: "list_concat" }] }
    ]
  },
  tools: [ { type: "function", function: { name: "s3_get_object", parameters: { type: "object" } } } ],
  input: { form: { rows: [{ a: 1 }, { a: 2 }, { a: 3 }] } }
};

describe("runPreview", () => {
  it("emits responses and completes", async () => {
    const evs: any[] = [];
    await runPreview(env, { toolResults: { s3_get_object: { ok: true } } }, (e) => evs.push(e));
    expect(evs.some(e => e.event === "response.created")).toBe(true);
    expect(evs.some(e => e.event === "response.completed")).toBe(true);
    expect(evs.filter(e => e.event === "response.output_text.delta").length).toBeGreaterThan(0);
  });
});
```

**`PreviewPanel.spec.tsx`** — renders and runs

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewPanel } from "../../PreviewPanel";

describe("PreviewPanel", () => {
  it("renders and starts", async () => {
    const doc: any = { id: "g", name: "t", nodes: [], edges: [] };
    render(<PreviewPanel doc={doc} />);
    const btn = screen.getByText("Start");
    fireEvent.click(btn);
    expect(screen.getByText(/SSE Console/)).toBeTruthy();
  });
});
```

---

## Acceptance Criteria

- A **Preview Runner** can take the **ExecuteEnvelope** and emit a stream of **OpenAI Responses‑style SSE** events.  
- Supports **entry.form**, **parallel.items** (bounded batches), **parallel.branches** (sequentially simulated but marked as parallel in telemetry), and **agent** (LLM) including **Combiner**.  
- Mock **tool calls** emit `tool_result.created` then `tool_result.done` with canned outputs (per tool name).  
- **PreviewPanel** shows an **SSE Console** and an assembled assistant transcript.  
- Unit tests cover the SSE generators, mock tools, runner happy path, and the panel rendering. **≥80%** coverage for new files.

---

## How to Review & Test

```bash
pnpm i
pnpm test

# In the builder UI:
# 1) Build a small graph: entry.form → parallel.items (concurrency 2, worker=agentA) → combiner agent.
# 2) Export (PR‑AB‑008) to produce an ExecuteEnvelope.
# 3) Open Preview panel; click Start. Watch SSE Console and Transcript assemble.
```

---

## Notes / Next

- **PR‑AB‑010:** Remote Tool Registries (MCP) + capability discovery & auth hints.  
- **PR‑AB‑011:** Wire the real Orchestration Engine; replace mock runner with live SSE via `/v1/execute/stream`.
