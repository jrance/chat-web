
# PROMPT FOR CODEX

Implement the following **Front‑End Hotfix PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR01a — Hotfix: Eliminate status race in `useResponsesStream` when overlapping sends occur

## Problem
When a new `send()` starts, the hook aborts the previous controller. The aborted run’s `catch/finally` still executes and calls `setStatus("idle")`, racing with the **new** stream that already set `status` to `"running"`. As soon as the old stream tears down, the hook flips back to `"idle"` even though a new request is in flight.

## Fix
Introduce a **generation token** (`opId`) and guard **all** state writes that should only apply to the *current* stream. Also swallow `AbortError` as a non‑error transition. Only set `"idle"` in the aborted run if it’s still the active op.

---

## Patch (drop‑in replacement for the hook)

```ts
// src/features/test-panel/hooks/useResponsesStream.ts
import { useCallback, useMemo, useRef, useState } from "react";
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
  const opRef = useRef(0); // generation token for the *current* stream

  const send = useCallback(async (ir: any, userText: string, headers: Record<string, string>) => {
    // Abort any in-flight stream first
    if (abortRef.current) {
      try { abortRef.current.abort("replaced"); } catch {}
    }

    const opId = ++opRef.current;        // claim a new generation
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Push user message synchronously
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      text: userText,
      time: Date.now(),
      done: true
    }]);
    setError(null);
    setStatus("running");

    const body: ExecuteRequestBody = { ir, input: { text: userText } };

    try {
      for await (const evt of executeStream(body, { headers, signal: ctrl.signal })) {
        // Ignore stale emissions
        if (opRef.current !== opId) break;

        switch (evt.type) {
          case "response.created":
            runIdRef.current = evt.run_id || evt.id || null;
            break;
          case "response.output_text.delta":
            setMessages(prev => {
              if (opRef.current !== opId) return prev;
              const last = prev[prev.length - 1];
              const isAssistant = last && last.role === "assistant" && !last.done;
              if (!isAssistant) {
                return [...prev, { id: crypto.randomUUID(), role: "assistant", text: evt.delta || "", time: Date.now(), done: false }];
              }
              const next = [...prev];
              next[next.length - 1] = { ...last, text: (last.text || "") + evt.delta };
              return next;
            });
            break;
          case "response.output_text.done":
            setMessages(prev => {
              if (opRef.current !== opId) return prev;
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && !last.done) {
                const next = [...prev];
                next[next.length - 1] = { ...last, done: true };
                return next;
              }
              return prev;
            });
            break;
          case "response.tool_result.created":
            setMessages(prev => {
              if (opRef.current !== opId) return prev;
              return [...prev, { id: crypto.randomUUID(), role: "tool", tool: { name: evt.name, callId: evt.call_id }, time: Date.now(), done: false }];
            });
            break;
          case "response.tool_result.done":
            setMessages(prev => {
              if (opRef.current !== opId) return prev;
              const i = [...prev].reverse().findIndex(m => m.role === "tool" && m.tool?.name === evt.name);
              if (i === -1) return prev;
              const idx = prev.length - 1 - i;
              const msg = prev[idx];
              const next = [...prev];
              next[idx] = {
                ...msg,
                done: true,
                tool: { ...(msg.tool || {}), result: evt.result, error: evt.error }
              };
              return next;
            });
            break;
          case "response.completed":
            if (opRef.current === opId) {
              setStatus(evt.status === "paused" ? "paused" : "done");
              setUsage(evt.usage || null);
            }
            break;
          case "response.error":
            if (opRef.current === opId) {
              setStatus("error");
              setError(evt.error?.message || "Unknown error");
            }
            break;
        }
      }
    } catch (e: any) {
      // Swallow AbortError from the *replaced* request
      const name = e?.name || e?.constructor?.name;
      if (opRef.current === opId) {
        if (name === "AbortError") {
          // if this abort belongs to us (user cancel), go idle
          setStatus("idle");
        } else {
          setStatus("error");
          setError(e?.message || String(e));
        }
      }
    } finally {
      // Only the *current* op may clear the controller or flip idle on cleanup
      if (abortRef.current === ctrl) {
        abortRef.current = null;
      }
      if (opRef.current === opId && (status === "running")) {
        // Safety: if stream ended without completed/error (unlikely), go idle
        setStatus("idle");
      }
    }
  }, [status]);

  const cancel = useCallback(() => {
    // Cancel only if we still own the active controller
    if (abortRef.current) {
      try { abortRef.current.abort("user-cancel"); } catch {}
    }
  }, []);

  return useMemo(() => ({
    runId: runIdRef.current,
    messages, status, usage, error,
    send, cancel,
  }), [messages, status, usage, error, send, cancel]);
}
```

### Notes
- The **generation token** (`opId`) ensures only the latest `send()` can update state.  
- We gate `setStatus("idle")` behind two checks:
  1) `abortRef.current === ctrl` (we still own the controller), and  
  2) `opRef.current === opId` (we are the active op).
- `AbortError` from the replaced stream is treated as a **non‑error** path to avoid flicker.

---

## Tests to add (or update)

`__tests__/useResponsesStream.spec.ts` — **race repro**

1) Fire `send(ir, "first")`, then immediately fire `send(ir, "second")` before the mock stream yields.  
2) Assert that `status` transitions to `"running"` and **never** reverts to `"idle"` when the first stream aborts.  
3) Ensure messages show **both** the first user message (done) and the second assistant stream deltas; final status is `"done"` once the second completes.

---

## Acceptance Criteria
- Rapid consecutive `send()` calls do **not** cause `status` to revert to `"idle"` mid‑stream.
- Aborting a previous request never updates state for the new request.
- Cancel works and sets `"idle"` only for the active op.
- Existing behaviors (delta assembly, tool created/done, completed/error) are unchanged.

