import React, { useState } from "react";
import { createPlanner, tick, complete, type PlannerState } from "../../state/parallel_planner";

type Props = {
  sampleItems?: unknown[];
  defaultConcurrency?: number;
  workerId?: string;
};

function defaultRows(n = 20) {
  return Array.from({ length: n }, (_, i) => ({ row: i + 1 }));
}

const clampPositiveInt = (value: number, min: number, fallback = 1): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value));
};

export const ParallelItemsSimulator: React.FC<Props> = ({
  sampleItems,
  defaultConcurrency = 8,
  workerId = "rowAgent",
}) => {
  const [rowsN, setRowsN] = useState<number>(sampleItems?.length ?? 20);
  const [conc, setConc] = useState<number>(defaultConcurrency);
  const [state, setState] = useState<PlannerState>(() =>
    createPlanner({
      concurrency: defaultConcurrency,
      items: sampleItems ?? defaultRows(rowsN),
      workerId,
    }),
  );
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
    setLog((entries) => [...entries, step.event]);
  };

  const markComplete = (n: number) => {
    if (n <= 0) return;
    const next = complete(state, n);
    setState(next);
    setLog((entries) => [
      ...entries,
      `?? worker: completed+=${Math.max(n, 0)} (${next.completed}/${next.total})`,
    ]);
  };

  return (
    <div className="ab-sim">
      <div className="ab-sim-controls">
        <label>Rows</label>
        <input
          className="ab-input"
          type="number"
          min={1}
          max={10000}
          value={rowsN}
          onChange={(e) => setRowsN(clampPositiveInt(Number(e.target.value || 1), 1, 20))}
        />
        <label>Concurrency</label>
        <input
          className="ab-input"
          type="number"
          min={1}
          max={1024}
          value={conc}
          onChange={(e) => setConc(clampPositiveInt(Number(e.target.value || 1), 1, 1))}
        />
        <button className="ab-btn" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="ab-sim-metrics">
        <div>
          <strong>Total:</strong> {state.total}
        </div>
        <div>
          <strong>Dispatched:</strong> {state.dispatched}
        </div>
        <div>
          <strong>Completed:</strong> {state.completed}
        </div>
        <div>
          <strong>Inflight:</strong> {inflight}
        </div>
        <div>
          <strong>Queue:</strong> {state.queue.length}
        </div>
      </div>

      <div className="ab-sim-actions">
        <button className="ab-btn" onClick={step} disabled={done}>
          Planner Step
        </button>
        <button className="ab-btn" onClick={() => markComplete(1)} disabled={done || inflight === 0}>
          Complete +1
        </button>
        <button
          className="ab-btn"
          onClick={() => markComplete(inflight)}
          disabled={done || inflight === 0}
        >
          Complete all inflight
        </button>
      </div>

      <div className="ab-sim-log">
        <h4>Events</h4>
        <ul>
          {log.map((entry, idx) => (
            <li key={`${entry}-${idx}`}>{entry}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
