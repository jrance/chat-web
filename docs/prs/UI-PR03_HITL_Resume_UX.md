
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR03 — HITL (Pause/Resume) UX: router choices & clarifying prompts

## Summary
Add **Human‑in‑the‑Loop** support to the Test panel so a paused run can be **resumed** via `/v1/execute/{runId}/resume`. The UI should:
- Detect `response.completed` with `status:"paused"` and attached `hitl` metadata.
- Render a **Resume Bar** that shows either **router branch choices** or a **clarifying input** (or both).
- POST a resume payload and **continue streaming** the same run to completion.

This PR builds on **UI‑PR01** (streaming) and works alongside **UI‑PR02** (widgets).

---

## Purpose
- Let reviewers drive ambiguous flows (router clarifications, missing context) right inside the Agent Builder.
- Keep the **streaming model**: resume creates a **new** POST stream that continues the same run.
- Keep code modular and race‑free (re‑use the generation/opId guard from UI‑PR01a).

---

## Scope
- New **Resume Bar** UI + styles.
- Hook updates to expose `resume()` and to capture `hitl` metadata.
- Thin `resumeStream()` client that POSTs to `/v1/execute/{runId}/resume` and yields Responses events.
- Tests for the pause → resume → done happy path, duplicate resume guard, and cancel during pause.

Non‑goals: Telemetry drawer (UI‑PR04), admin widgets.

---

## Files to Add / Change

```
src/
  lib/
    orch/
      client.ts                # ADD: resumeStream(...)
      types.ts                 # ADD: HITL types
  features/
    test-panel/
      hooks/
        useResponsesStream.ts  # CHANGE: expose resume(), hitl state; handle paused lifecycle
      components/
        ResumeBar.tsx          # NEW: router-choice buttons + clarifying prompt input
        TestChatPane.tsx       # CHANGE: mount <ResumeBar/> when paused
__tests__/
  hitl.resume.spec.ts          # NEW: pause→resume flow tests
```

---

## Types (`src/lib/orch/types.ts`)

```ts
export type HitlRouterChoice = {
  kind: "router_choice";
  // minimal normalized shape
  targets: Array<{ id: string; label?: string }>; // labels optional; fall back to id
  message?: string; // optional prompt from backend
};

export type HitlClarify = {
  kind: "user_message";
  message?: string;   // prompt text, e.g., "Please clarify your request"
  placeholder?: string;
};

export type HitlMeta = HitlRouterChoice | HitlClarify | (HitlRouterChoice & HitlClarify); // some engines may send both

export type ResponsesCompletedEvent = {
  type: "response.completed";
  status: "completed" | "paused";
  usage?: any;
  hitl?: HitlMeta | null;
};

export type ResumePayload =
  | { kind: "router_choice"; choice: { target: string } }
  | { kind: "user_message"; message: string };
```

> We tolerate additional fields (the engine may send more). Only `kind` and minimal payload are required on the client.

---

## Client: `resumeStream` (`src/lib/orch/client.ts`)

```ts
export async function* resumeStream(runId: string, payload: ResumePayload, opts: ExecuteOptions = {}) {
  const controller = new AbortController();
  const signal = opts.signal ?? controller.signal;
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(`${API_BASE}/v1/execute/${encodeURIComponent(runId)}/resume`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`resume failed: ${res.status} ${text}`);
  }
  for await (const sse of sseIterator(res.body)) {
    const evt = parseResponsesEvent(sse);
    if (evt) yield evt;
  }
}
```

---

## Hook changes (`src/features/test-panel/hooks/useResponsesStream.ts`)

> Starting from UI‑PR01a (with opId race guard). Only the **diff** is shown.

```ts
// add near top:
import { resumeStream } from "../../../lib/orch/client";
import type { HitlMeta, ResumePayload } from "../../../lib/orch/types";

// new state:
const [hitl, setHitl] = useState<HitlMeta | null>(null);

// inside send() streaming loop, on completed:
case "response.completed":
  if (opRef.current === opId) {
    setStatus(evt.status === "paused" ? "paused" : "done");
    setUsage(evt.usage || null);
    setHitl(evt.hitl || null);
  }
  break;

// expose a resume function
const resume = useCallback(async (payload: ResumePayload, headers: Record<string,string>) => {
  const activeRunId = runIdRef.current;
  if (!activeRunId) throw new Error("No active runId to resume");
  // Abort any stale stream first
  if (abortRef.current) { try { abortRef.current.abort("resume"); } catch {} }
  const opId = ++opRef.current;
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  setError(null);
  setStatus("running");     // resume progresses the same run
  setHitl(null);

  try {
    for await (const evt of resumeStream(activeRunId, payload, { headers, signal: ctrl.signal })) {
      if (opRef.current !== opId) break;
      // Re-use the same switch as in send() for deltas, tool events, completed, etc.
      switch (evt.type) {
        case "response.output_text.delta": /* same as send */ break;
        case "response.output_text.done": /* same as send */ break;
        case "response.tool_result.created": /* same as send */ break;
        case "response.tool_result.done": /* same as send */ break;
        case "response.completed":
          if (opRef.current === opId) {
            setStatus(evt.status === "paused" ? "paused" : "done");
            setUsage(evt.usage || null);
            setHitl(evt.hitl || null);
          }
          break;
        case "response.error":
          if (opRef.current === opId) { setStatus("error"); setError(evt.error?.message || "Unknown error"); }
          break;
      }
    }
  } catch (e:any) {
    const name = e?.name || e?.constructor?.name;
    if (opRef.current === opId) {
      if (name === "AbortError") { setStatus("idle"); }
      else { setStatus("error"); setError(e?.message || String(e)); }
    }
  } finally {
    if (abortRef.current === ctrl) abortRef.current = null;
  }
}, []);

// return the new API:
return useMemo(() => ({
  runId: runIdRef.current,
  messages, status, usage, error, hitl,
  send, resume, cancel,
}), [messages, status, usage, error, hitl, send, resume, cancel]);
```

---

## Resume Bar component (`src/features/test-panel/components/ResumeBar.tsx`)

```tsx
import { useState } from "react";
import type { HitlMeta, ResumePayload } from "../../../lib/orch/types";

type Props = {
  hitl: HitlMeta;
  onResume: (payload: ResumePayload) => void;
  busy?: boolean;
};

export default function ResumeBar({ hitl, onResume, busy }: Props) {
  const [msg, setMsg] = useState("");

  const hasRouter = (hitl as any)?.kind === "router_choice" || (hitl as any)?.targets;
  const hasClarify = (hitl as any)?.kind === "user_message" || (hitl as any)?.placeholder || (hitl as any)?.message;

  return (
    <div className="border-t border-neutral-800 p-2 bg-neutral-950">
      {hasRouter && (
        <div className="mb-2 flex flex-wrap gap-2">
          {(hitl as any).targets?.map((t: any) => (
            <button key={t.id} disabled={busy}
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
              onClick={() => onResume({ kind: "router_choice", choice: { target: t.id } })}>
              {t.label || t.id}
            </button>
          ))}
        </div>
      )}
      {hasClarify && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm outline-none"
            placeholder={(hitl as any)?.placeholder || (hitl as any)?.message || "Add clarification..."}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            disabled={busy}
          />
          <button
            onClick={() => onResume({ kind: "user_message", message: msg })}
            className="px-3 py-2 bg-green-600 text-white rounded text-sm"
            disabled={busy || !msg.trim()}>
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Wire the Resume Bar into the Test panel (`TestChatPane.tsx`)

```tsx
import ResumeBar from "./ResumeBar";
import { useResponsesStream } from "../hooks/useResponsesStream";

// ... inside component
const { status, hitl, resume } = useResponsesStream(); // already from context/hook in your app
const [busy, setBusy] = useState(false);

const onResume = async (payload: ResumePayload) => {
  setBusy(true);
  const headers = {
    Authorization: `Bearer ${authToken}`,
    "X-Tenant-ID": tenantId,
    "X-Request-ID": crypto.randomUUID(),
    "X-Correlation-ID": crypto.randomUUID(),
    "X-Telemetry": "none",
  };
  try {
    await resume(payload, headers);
  } finally {
    setBusy(false);
  }
};

{status === "paused" && hitl && (
  <ResumeBar hitl={hitl} onResume={onResume} busy={busy} />
)}
```

---

## Tests (`__tests__/hitl.resume.spec.ts`)

- **pause → resume (router)**: mock stream to emit `response.completed { status:"paused", hitl:{ kind:"router_choice", targets:[{id:"A"}] } }`, then ensure calling `resume({kind:"router_choice", choice:{target:"A"}})` continues streaming deltas and reaches `done` with no idle flicker.
- **pause → resume (clarify)**: same, but with `hitl:{ kind:"user_message", message:"clarify" }` and resume `{ kind:"user_message", message:"..." }`.
- **duplicate resume guard**: fire two resumes quickly; ensure opId gating prevents stale cleanup from flipping state.
- **cancel while paused**: ensure `cancel()` sets idle and clears `hitl`.

Use mocked generators for `executeStream` and `resumeStream` to keep tests deterministic.

---

## Acceptance Criteria
- When a run pauses, the Test panel shows a **Resume Bar** with router buttons and/or a clarifying input (based on `hitl`).
- Clicking a choice or submitting a message calls **resume**, opens a new stream, and the conversation continues to `done` (or pauses again).
- The hook exposes `hitl` and `resume()`; state transitions are race‑free (no idle flicker on overlapping resumes).
- No new heavy deps; TypeScript remains strict; tests pass.

---

## Validation (manual)
1) Trigger a prompt that causes a router pause (e.g., ambiguous input).  
2) Confirm Resume Bar appears with targets; select a branch → stream continues.  
3) Trigger a clarifying prompt pause; enter guidance → stream continues.  
4) Click cancel while paused; panel returns to idle; Resume Bar disappears.

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** focused components (`ResumeBar` does one thing well).  
- **Async correctness:** only the current op can change state (generation token); always abort stale streams.  
- **Minimal deps:** platform APIs; no event emitter libs; keep CSS utility‑first.  
- **Performance:** avoid rerender storms; memoize props; keep ResumeBar out of the tree when not paused.  
- **Security:** treat resume payloads as data; never interpolate into HTML; escape user inputs where displayed.  
- **A11y:** Resume Bar buttons are keyboard‑navigable; input has a label/placeholder; announcements for pause state.  
- **Config:** no hard‑coded URLs/tokens; headers come via props/env.  
- **Errors:** show friendly retry affordance on resume errors; don’t leave the UI stuck in “busy”.  
- **Tests:** deterministic, no network; exercise router + clarify paths; assert race‑free transitions.  
- **Extensibility:** tolerate richer `hitl` payloads (extra fields); router targets can evolve without FE changes.
