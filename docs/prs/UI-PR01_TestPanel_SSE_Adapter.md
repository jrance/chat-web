
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR01 — Test Panel: Wire to Orchestration Engine (Responses Stream) + SSE Adapter

## Summary
Connect the **Agent Builder UI** “Test” panel (right side) to the new orchestration engine’s **/v1/execute/stream** endpoint and normalize streamed **Responses** events into a simple `ChatMessage[]` the UI can render. This PR adds a small **SSE adapter**, typed models, a React hook, and minimal UI glue. Telemetry and HITL resume UX will arrive in later PRs.

> Scope: **Main Responses stream only** (`response.*` events). Telemetry stream and resume bar will be implemented in UI‑PR04 and UI‑PR03 respectively.

---

## Purpose
- Allow designers to test a graph from the canvas immediately—no separate client.
- Provide a **thin, well‑typed adapter** so future engines or protocol bumps only change one place.
- Keep FE dependencies minimal and avoid lock‑in to any chat UI library.

---

## Goals
- POST the current IR + user input to `/v1/execute/stream` with required headers.
- Parse the streamed **Responses** events (text/tool lifecycle) over a `fetch` **ReadableStream** (supports POST).
- Expose a `useResponsesStream` hook returning `{runId, messages, status, usage, error, send, cancel}`.
- Render incremental assistant output (`response.output_text.delta` → accumulating text) and show tool lifecycle using `response.tool_result.created/done` when present.
- Handle error and cancellation cleanly.

---

## Non‑Goals (handled in later PRs)
- Telemetry stream, event timeline (UI‑PR04).
- HITL resume UI (`/v1/execute/{runId}/resume`) (UI‑PR03).
- Widget host/registry (UI‑PR02) — this PR still renders markdown/plain only.

---

## Files to Add / Change

```
src/
  lib/
    orch/
      types.ts                 # Types for events, chat messages, and request body
      sse.ts                   # Streaming SSE parser over fetch(ReadbleStream)
      client.ts                # executeStream(...) thin client
  features/
    test-panel/
      hooks/
        useResponsesStream.ts  # React hook composing client + state
      components/
        TestChatPane.tsx       # Glue to existing right-pane Test toggle
  app/
    config.ts                  # (if not present) API base URL & helpers
__tests__/
  sse.spec.ts                  # Unit test for SSE parser (happy/edge cases)
  useResponsesStream.spec.ts   # Hook behavior: start, delta assembly, cancel, error
```

> Adjust paths to your project structure if needed; keep the modular separation (`lib/orch/*`, `features/test-panel/*`).

---

## Implementation

### 1) Types (`src/lib/orch/types.ts`)

```ts
export type WidgetEnvelope = { kind: string; version?: string; props?: Record<string, any> };

export type ResponsesEvent =
  | { type: "response.created"; id?: string; run_id?: string }
  | { type: "response.output_text.delta"; delta: string; ui?: WidgetEnvelope }
  | { type: "response.output_text.done" }
  | { type: "response.function_call_arguments.delta"; name: string; arguments: string }
  | { type: "response.function_call_arguments.done"; name: string }
  | { type: "response.tool_result.created"; name: string; call_id?: string }
  | { type: "response.tool_result.done"; name: string; call_id?: string; result?: any; error?: { code: string; message: string } }
  | { type: "response.completed"; status: "completed" | "paused"; usage?: any; hitl?: any }
  | { type: "response.error"; error: { code: string; message: string; details?: any } };

export type ExecuteOptions = {
  headers?: Record<string, string>; // Authorization, X-Tenant-ID, etc.
  signal?: AbortSignal;
};

export type ExecuteRequestBody = {
  ir: any;              // orchestration package (IR)
  input: { text: string };
  options?: Record<string, any>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  text?: string;
  widgets?: WidgetEnvelope[];
  tool?: { name: string; callId?: string; result?: any; error?: { code: string; message: string } };
  time: number;
  done?: boolean;
};
```

### 2) SSE parser (`src/lib/orch/sse.ts`)

> We **don’t** use `EventSource` because we need **POST**; we parse SSE manually from `fetch`’s `ReadableStream`.

```ts
export interface ParsedSSE { event?: string; data?: string }

export async function* sseIterator(stream: ReadableStream<Uint8Array>): AsyncGenerator<ParsedSSE> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = chunk.split("\n");
        let event: string | undefined;
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        yield { event, data };
      }
    }
    if (buf.trim().length) {
      const lines = buf.split("\n");
      let event: string | undefined;
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event || data) yield { event, data };
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseResponsesEvent(sse: ParsedSSE): any | null {
  if (!sse.data) return null;
  try { return JSON.parse(sse.data); } catch { return null; }
}
```

### 3) Thin client (`src/lib/orch/client.ts`)

```ts
import { ExecuteOptions, ExecuteRequestBody } from "./types";
import { sseIterator, parseResponsesEvent } from "./sse";
import { API_BASE } from "../../app/config";

export async function* executeStream(body: ExecuteRequestBody, opts: ExecuteOptions = {}) {
  const controller = new AbortController();
  const signal = opts.signal ?? controller.signal;
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}/v1/execute/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`execute/stream failed: ${res.status} ${text}`);
  }
  for await (const sse of sseIterator(res.body)) {
    const evt = parseResponsesEvent(sse);
    if (evt) yield evt; // ResponsesEvent shape
  }
}
```

### 4) Hook (`src/features/test-panel/hooks/useResponsesStream.ts`)

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, ExecuteRequestBody } from "../../../lib/orch/types";
import { executeStream } from "../../../lib/orch/client";

type Status = "idle" | "running" | "paused" | "done" | "error";

export function useResponsesStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (ir: any, userText: string, headers: Record<string,string>) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: userText, time: Date.now(), done: true }]);
    setStatus("running");
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const body: ExecuteRequestBody = { ir, input: { text: userText } };

    try {
      for await (const evt of executeStream(body, { headers, signal: ctrl.signal })) {
        switch (evt.type) {
          case "response.created":
            runIdRef.current = evt.run_id || evt.id || null;
            break;
          case "response.output_text.delta":
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              const isAssistant = last && last.role === "assistant" && !last.done;
              if (!isAssistant) {
                return [...prev, { id: crypto.randomUUID(), role: "assistant", text: evt.delta || "", time: Date.now(), done: false }];
              }
              last.text = (last.text || "") + evt.delta;
              return [...prev.slice(0, -1), last];
            });
            break;
          case "response.output_text.done":
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && !last.done) {
                last.done = true;
                return [...prev.slice(0, -1), last];
              }
              return prev;
            });
            break;
          case "response.tool_result.created":
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "tool", tool: { name: evt.name, callId: evt.call_id }, time: Date.now(), done: false }]);
            break;
          case "response.tool_result.done":
            setMessages((prev) => {
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].role === "tool" && prev[i].tool?.name === evt.name) {
                  const msg = { ...prev[i] };
                  msg.tool = { ...(msg.tool || {}), result: evt.result, error: evt.error };
                  msg.done = true;
                  return [...prev.slice(0, i), msg, ...prev.slice(i + 1)];
                }
              }
              return prev;
            });
            break;
          case "response.completed":
            setStatus(evt.status === "paused" ? "paused" : "done");
            setUsage(evt.usage || null);
            break;
          case "response.error":
            setStatus("error");
            setError(evt.error?.message || "Unknown error");
            break;
        }
      }
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || String(e));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return useMemo(() => ({
    runId: runIdRef.current,
    messages, status, usage, error,
    send, cancel,
  }), [messages, status, usage, error, send, cancel]);
}
```

### 5) Test Chat pane glue (`src/features/test-panel/components/TestChatPane.tsx`)

```tsx
import { useState } from "react";
import { useResponsesStream } from "../hooks/useResponsesStream";

type Props = { apiBase: string; ir: any; tenantId: string; authToken: string };

export default function TestChatPane({ apiBase, ir, tenantId, authToken }: Props) {
  const [input, setInput] = useState("");
  const { runId, messages, status, error, send, cancel } = useResponsesStream();

  const onSend = () => {
    if (!input.trim()) return;
    const headers = {
      Authorization: `Bearer ${authToken}`,
      "X-Tenant-ID": tenantId,
      "X-Request-ID": crypto.randomUUID(),
      "X-Correlation-ID": crypto.randomUUID(),
      "X-Telemetry": "none",
    };
    (window as any).__API_BASE__ = apiBase;
    send(ir, input, headers);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 p-3 bg-neutral-950 text-neutral-50">
        {messages.map(m => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className="inline-block max-w-[70%] rounded-lg px-3 py-2"
                 style={{ background: m.role === "user" ? "#2f3140" : "#1e1f2b" }}>
              {m.text}
              {m.role === "tool" && <pre className="mt-2 text-xs opacity-80 overflow-auto">
                {m.tool?.error ? JSON.stringify(m.tool.error, null, 2) : JSON.stringify(m.tool?.result, null, 2)}
              </pre>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-800 p-2 flex gap-2">
        <input className="flex-1 bg-neutral-900 text-neutral-50 rounded px-3 py-2 outline-none"
               placeholder={status === "paused" ? "Run paused… (resume in UI‑PR03)" : "Type a message…"}
               value={input} onChange={e => setInput(e.target.value)} />
        <button onClick={onSend} className="px-3 py-2 bg-blue-600 text-white rounded">Send</button>
        <button onClick={cancel} className="px-3 py-2 bg-neutral-700 text-white rounded">Cancel</button>
      </div>
      {error && <div className="text-red-400 text-sm px-3 py-2">Error: {error}</div>}
    </div>
  );
}
```

### 6) App config (`src/app/config.ts`)

```ts
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
```

### 7) Tests (minimal)

- `__tests__/sse.spec.ts`: unit test the line-splitting and JSON parsing (including partial chunk joins).
- `__tests__/useResponsesStream.spec.ts`: mock `executeStream` generator; assert message accumulation and status transitions.

---

## Acceptance Criteria
- Test panel streams assistant replies incrementally; tool lifecycle shows created/done with JSON result.
- Abort works; no dangling streams on unmount or cancel.
- No new runtime deps added; TypeScript types compile with `strict`.
- Unit tests pass for parser and hook.

---

## Validation
1) Run engine locally.  
2) Load a sample IR that uses the web‑search tool.  
3) In Test panel, send prompt; observe deltas and tool result card; final status is `done` (or `paused`).  
4) Cancel mid‑stream and verify it stops immediately.

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** small focused components; explicit props; clear boundaries.  
- **Types everywhere:** strict TypeScript; no `any` in public interfaces.  
- **Async correctness:** cancel on unmount; use `AbortController`; debounce UI updates if needed.  
- **Minimal deps:** prefer platform APIs; keep bundles lean.  
- **Performance:** batch state updates; virtualize long lists; avoid hot re‑renders.  
- **Security:** sanitize any markdown; never inject raw HTML; cap payload sizes.  
- **A11y:** keyboard accessible, ARIA roles, focus management on send/error.  
- **Config:** no hardcoded URLs/tokens; use env/props.  
- **Errors:** user‑friendly UI; detailed logs in dev; no crashes.  
- **Tests:** deterministic; no network; cover parser + state transitions.  
- **Extensibility:** keep `lib/orch/*` stable; widgets register via simple map in UI‑PR02.
