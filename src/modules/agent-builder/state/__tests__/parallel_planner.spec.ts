import { describe, it, expect } from "vitest";
import { createPlanner, tick, complete } from "../parallel_planner";

describe("parallel planner", () => {
  it("bounded dispatch then waits for completions", () => {
    let state = createPlanner({ concurrency: 3, items: [1, 2, 3, 4, 5], workerId: "w" });

    let result = tick(state);
    state = result.state;
    expect(state.dispatched).toBe(3);
    expect(result.step.event).toMatch(/dispatched\+=3/);

    result = tick(state);
    state = result.state;
    expect(state.dispatched).toBe(3);
    expect(result.step.event).toMatch(/waiting/);

    state = complete(state, 2);
    expect(state.completed).toBe(2);

    result = tick(state);
    state = result.state;
    expect(state.dispatched).toBe(5);
    expect(state.queue.length).toBe(0);
  });

  it("never dispatches more than concurrency", () => {
    let state = createPlanner({ concurrency: 2, items: [1, 2, 3, 4], workerId: "w" });
    let result = tick(state);
    state = result.state;
    expect(state.dispatched - state.completed).toBe(2);

    result = tick(state);
    state = result.state;
    expect(state.dispatched - state.completed).toBe(2);
  });
});
