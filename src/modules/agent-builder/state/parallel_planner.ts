export type Row = unknown;
export type Send = { workerId: string; payload: { item: Row } };

export interface PlannerState {
  concurrency: number;
  total: number;
  dispatched: number;
  completed: number;
  queue: Row[];
  workerId: string;
}

export interface PlannerStep {
  updates: Partial<PlannerState>;
  sends: Send[];
  event: string;
}

function calcInflight(s: PlannerState): number {
  return Math.max(s.dispatched - s.completed, 0);
}

/** Compute a single planner step. */
export function planStep(s: PlannerState): PlannerStep {
  const inflight = calcInflight(s);
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
    event = `?? planner: inflight=${inflight} cap=${capacity} dispatched+=${dispatchedDelta} (${updates.dispatched}/${s.total})`;
  } else if (s.completed < s.total) {
    event = `? planner: waiting - inflight=${inflight}, completed=${s.completed}/${s.total}`;
  } else {
    event = `? planner: all rows completed (${s.completed}/${s.total})`;
  }

  return { updates, sends, event };
}

export function tick(s: PlannerState): { state: PlannerState; step: PlannerStep } {
  const step = planStep(s);
  const next: PlannerState = {
    ...s,
    ...step.updates,
  };
  return { state: next, step };
}

export function complete(s: PlannerState, n: number): PlannerState {
  const completed = Math.min(s.completed + Math.max(n, 0), s.total);
  return { ...s, completed };
}

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
