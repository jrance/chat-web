
# PR‑AB‑005 — Parallel (Items) Telemetry & Bounded‑Concurrency Planner + Simulator

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001/002/003/004  
**Scope:** Implement a bounded‑concurrency **planner** for `parallel.items` (fan‑out over an array with capacity control), add **telemetry hooks** (in‑UI progress), and ship a **Simulator** UI so users can validate the math before export. This PR touches only the builder (design‑time); engine runtime wiring is a later server PR.  
**Coverage target:** **≥80%** (Vitest + RTL).

---

## Tenets

1. **Deterministic orchestration math** — `inflight = dispatched − completed`; `capacity = max(concurrency − inflight, 0)`; dispatch `min(capacity, queue.length)` per step.  
2. **Spec‑first** — Planner state mirrors IR v0.3 `parallel.items` inputs: `items[]`, `concurrency`, `workerId`.  
3. **Observability** — Emit planner **events** suitable for SSE (“telemetry-like”) and surface inflight/completed/total.  
4. **Codeless UX** — A **Simulator** lets users tweak `concurrency`, step the planner, and simulate worker completions—no code.  
5. **Quality** — Pure functions for math; component tests cover user flows.

---

## File changes (under `src/modules/agent-builder`)

### 1) **NEW** `state/parallel_planner.ts` — pure planner

```ts
// src/modules/agent-builder/state/parallel_planner.ts
export type Row = unknown; // planner treats items opaquely
export type Send = { workerId: string; payload: { item: Row } };

export interface PlannerState {
  concurrency: number;
  total: number;          // total rows overall
  dispatched: number;     // rows sent to workers so far
  completed: number;      // rows completed so far
  queue: Row[];           // remaining rows to dispatch
  workerId: string;       // target worker node id (from IR)
}

export interface PlannerStep {
  updates: Partial<PlannerState>;
  sends: Send[];
  event: string;          // human readable log line
}

/** Compute a single planner step.
 * inflight = max(dispatched - completed, 0)
 * capacity = max(concurrency - inflight, 0)
 * n = min(capacity, queue.length)
 */
export function planStep(s: PlannerState): PlannerStep {
  const inflight = Math.max(s.dispatched - s.completed, 0);
  const capacity = Math.max(s.concurrency - inflight, 0);
  const n = Math.min(capacity, s.queue.length);
  const sends: Send[] = [];
  let dispatchedDelta = 0;
  const nextQueue = s.queue.slice();
  for (let i = 0; i < n; i++) {
    const item = nextQueue.shift()!;
    sends.push({ workerId: s.workerId, payload: { item } });
    dispatchedDelta++;
  }
  const updates: Partial<PlannerState> = {
    queue: nextQueue,
    dispatched: s.dispatched + dispatchedDelta,
  };

  let event: string;
  if (dispatchedDelta > 0) {
    event = `🧭 planner: inflight=${inflight} cap=${capacity} dispatched+=${dispatchedDelta} (${updates.dispatched}/${s.total})`;
  } else if (s.completed < s.total) {
    event = `⏳ planner: waiting — inflight=${inflight}, completed=${s.completed}/${s.total}`;
  } else {
    event = `✅ planner: all rows completed (${s.completed}/${s.total})`;
  }
  return { updates, sends, event };
}

/** Advance the planner by one step (pure). */
export function tick(s: PlannerState): { state: PlannerState; step: PlannerStep } {
  const step = planStep(s);
  const next: PlannerState = {
    ...s,
    ...step.updates,
  };
  return { state: next, step };
}

/** Simulate worker completions by incrementing completed. */
export function complete(s: PlannerState, n: number): PlannerState {
  const completed = Math.min(s.completed + Math.max(n, 0), s.total);
  return { ...s, completed };
}

/** Create an initial planner state from IR‑like inputs. */
export function createPlanner(opts: {
  concurrency: number;
  items: Row[];
  workerId: string;
}): PlannerState {
  return {
    concurrency: Math.max(1, Math.floor(opts.concurrency || 1)),
    workerId: opts.workerId,
    total: opts.items.length,
    dispatched: 0,
    completed: 0,
    queue: opts.items.slice(),
  };
}
```

---

### 2) **NEW** `components/Simulator/ParallelItemsSimulator.tsx` — interactive UI

```tsx
// src/modules/agent-builder/components/Simulator/ParallelItemsSimulator.tsx
import React, { useMemo, useState } from "react";
import { createPlanner, tick, complete, type PlannerState } from "../../state/parallel_planner";

type Props = {
  sampleItems?: unknown[];      // default: 20 numbered rows
  defaultConcurrency?: number;  // default: 8
  workerId?: string;            // default: "rowAgent"
};

function defaultRows(n = 20) {
  return Array.from({ length: n }, (_, i) => ({ row: i + 1 }));
}

export const ParallelItemsSimulator: React.FC<Props> = ({ sampleItems, defaultConcurrency = 8, workerId = "rowAgent" }) => {
  const [rowsN, setRowsN] = useState<number>(sampleItems?.length ?? 20);
  const [conc, setConc] = useState<number>(defaultConcurrency);
  const [state, setState] = useState<PlannerState>(() => createPlanner({ concurrency: defaultConcurrency, items: sampleItems ?? defaultRows(rowsN), workerId }));
  const [log, setLog] = useState<string[]>([]);

  const inflight = Math.max(state.dispatched - state.completed, 0);
  const done = state.completed >= state.total;

  const reset = () => {
    const items = sampleItems ?? defaultRows(rowsN);
    const s = createPlanner({ concurrency: conc, items, workerId });
    setState(s);
    setLog([]);
  };

  const step = () => {
    const { state: next, step } = tick(state);
    setState(next);
    setLog((L) => [...L, step.event]);
  };

  const markComplete = (n: number) => {
    const next = complete(state, n);
    setState(next);
    setLog((L) => [...L, `✔️ worker: completed+=${Math.max(n,0)} (${next.completed}/${next.total})`]);
  };

  return (
    <div className="ab-sim">
      <div className="ab-sim-controls">
        <label>Rows</label>
        <input className="ab-input" type="number" min={1} max={10000} value={rowsN} onChange={(e) => setRowsN(Math.max(1, Number(e.target.value || 1)))} />
        <label>Concurrency</label>
        <input className="ab-input" type="number" min={1} max={1024} value={conc} onChange={(e) => setConc(Math.max(1, Number(e.target.value || 1)))} />
        <button className="ab-btn" onClick={reset}>Reset</button>
      </div>

      <div className="ab-sim-metrics">
        <div><strong>Total:</strong> {state.total}</div>
        <div><strong>Dispatched:</strong> {state.dispatched}</div>
        <div><strong>Completed:</strong> {state.completed}</div>
        <div><strong>Inflight:</strong> {inflight}</div>
        <div><strong>Queue:</strong> {state.queue.length}</div>
      </div>

      <div className="ab-sim-actions">
        <button className="ab-btn" onClick={step} disabled={done}>Planner Step</button>
        <button className="ab-btn" onClick={() => markComplete(1)} disabled={done || inflight === 0}>Complete +1</button>
        <button className="ab-btn" onClick={() => markComplete(inflight)} disabled={done || inflight === 0}>Complete all inflight</button>
      </div>

      <div className="ab-sim-log">
        <h4>Events</h4>
        <ul>
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
};
```

---

### 3) **UPDATE** `components/NodeCard/ParallelItemsCard.tsx` — add metrics & simulator entry

```tsx
// src/modules/agent-builder/components/NodeCard/ParallelItemsCard.tsx
import React, { useState } from "react";
import type { ParallelItemsNode } from "../../model/ir";
import { ParallelItemsSimulator } from "../Simulator/ParallelItemsSimulator";

type Props = { node: ParallelItemsNode; onChange: (next: ParallelItemsNode) => void };

export const ParallelItemsCard: React.FC<Props> = ({ node, onChange }) => {
  const c = node.config;
  const [showSim, setShowSim] = useState(false);

  return (
    <div className="ab-card">
      <label>Concurrency</label>
      <input
        className="ab-input"
        type="number"
        min={1}
        max={1024}
        value={c.concurrency}
        onChange={(e) => onChange({ ...node, config: { ...c, concurrency: Number(e.target.value || 1) } })}
      />
      <label>Worker Node Id</label>
      <input
        className="ab-input"
        type="text"
        value={c.workerId}
        onChange={(e) => onChange({ ...node, config: { ...c, workerId: e.target.value } })}
      />
      <small className="ab-help">The worker must exist in the graph and accept the item payload.</small>

      <div className="ab-divider" />

      <button className="ab-btn" onClick={() => setShowSim(s => !s)}>
        {showSim ? "Hide" : "Open"} Concurrency Simulator
      </button>

      {showSim && (
        <div className="ab-sim-wrap">
          <ParallelItemsSimulator defaultConcurrency={c.concurrency} workerId={c.workerId} />
        </div>
      )}
    </div>
  );
};
```

---

### 4) **Telemetry stub (design‑time)**

- The simulator emits human‑readable **events** that mirror planner status:
  - `🧭 planner: inflight=… cap=… dispatched+=N (D/T)`  
  - `⏳ planner: waiting — inflight=…, completed=D/T`  
  - `✔️ worker: completed+=N (D/T)`  
  - `✅ planner: all rows completed (T/T)`  
- These event lines are chosen to map cleanly to runtime SSE later (`response.telemetry.delta`) without forcing the UI now.

No code file needed beyond strings already returned in `ParallelItemsSimulator` & `planStep`.

---

### 5) **Tests**

```
src/modules/agent-builder/state/__tests__/parallel_planner.spec.ts
src/modules/agent-builder/components/Simulator/__tests__/ParallelItemsSimulator.spec.tsx
```

**`parallel_planner.spec.ts`** — math correctness

```ts
import { describe, it, expect } from "vitest";
import { createPlanner, tick, complete } from "../../parallel_planner";

describe("parallel planner", () => {
  it("bounded dispatch then wait until completions", () => {
    let s = createPlanner({ concurrency: 3, items: [1,2,3,4,5], workerId: "w" });
    // step1: dispatch 3
    let r = tick(s); s = r.state;
    expect(s.dispatched).toBe(3);
    // step2: inflight=3, cap=0 -> wait
    r = tick(s); s = r.state;
    expect(s.dispatched).toBe(3);
    // complete 2
    s = complete(s, 2);
    // step3: inflight=1, cap=2 -> dispatch 2 (one left in queue after)
    r = tick(s); s = r.state;
    expect(s.dispatched).toBe(5);
    expect(s.queue.length).toBe(0);
  });

  it("never dispatches more than concurrency", () => {
    let s = createPlanner({ concurrency: 2, items: [1,2,3,4], workerId: "w" });
    let r = tick(s); s = r.state; // dispatch 2
    r = tick(s); s = r.state;     // wait
    expect(s.dispatched - s.completed).toBe(2);
  });
});
```

**`ParallelItemsSimulator.spec.tsx`** — basic interactions

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParallelItemsSimulator } from "../../ParallelItemsSimulator";

describe("ParallelItemsSimulator", () => {
  it("resets and steps planner", () => {
    render(<ParallelItemsSimulator defaultConcurrency={2} />);
    // first step dispatches up to 2
    fireEvent.click(screen.getByText("Planner Step"));
    expect(screen.getByText(/Dispatched:\s*2/)).toBeTruthy();
    // complete inflight
    fireEvent.click(screen.getByText("Complete all inflight"));
    expect(screen.getByText(/Completed:\s*2/)).toBeTruthy();
    // step again dispatches next 2
    fireEvent.click(screen.getByText("Planner Step"));
    expect(screen.getByText(/Dispatched:\s*4/)).toBeTruthy();
  });
});
```

---

### 6) **Styles (add to builder CSS)**

```css
/* Parallel Simulator */
.ab-sim { display: grid; gap: 10px; border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: var(--card); }
.ab-sim-controls { display: flex; gap: 8px; align-items: center; }
.ab-sim-metrics { display: grid; grid-template-columns: repeat(5, auto); gap: 12px; font-size: 14px; }
.ab-sim-actions { display: flex; gap: 8px; }
.ab-sim-log { max-height: 160px; overflow: auto; }
.ab-sim-wrap { margin-top: 8px; }
.ab-divider { height: 1px; background: var(--line); margin: 8px 0; }
```

---

## Acceptance Criteria

- `parallel_planner.ts` exposes pure `createPlanner`, `tick`, `complete` with the exact bounded‑concurrency behavior above.  
- `ParallelItemsCard` displays the **Simulator** toggle and concurrency settings.  
- **Simulator** shows metrics (total, dispatched, completed, inflight, queue) and logs event lines on each step/completion.  
- Unit tests validate planner math and simulator interactions.  
- **≥80%** coverage for new files.

---

## How to Review & Test

```bash
pnpm i
pnpm test
# In UI: open an Agent → Parallel (Items) node, click "Open Concurrency Simulator".
```

---

## Notes / Next

- **PR‑AB‑006** will add `parallel.branches` broadcast UX + Combiner Agent schema selector and evidence fan‑in.
- Exporter will read `parallel.items` config and edge mappings to generate engine request envelopes.
