import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParallelItemsSimulator } from "../ParallelItemsSimulator";

const readMetric = (label: string) => {
  const el = screen.getByText(label, { selector: "strong" });
  return el.parentElement?.textContent ?? "";
};

describe("ParallelItemsSimulator", () => {
  it("resets, steps, and completes planner work", () => {
    render(<ParallelItemsSimulator defaultConcurrency={2} />);

    fireEvent.click(screen.getByText("Planner Step"));
    expect(readMetric("Dispatched:")).toMatch(/Dispatched:\s*2/);

    fireEvent.click(screen.getByText("Complete all inflight"));
    expect(readMetric("Completed:")).toMatch(/Completed:\s*2/);

    fireEvent.click(screen.getByText("Planner Step"));
    expect(readMetric("Dispatched:")).toMatch(/Dispatched:\s*4/);
  });
});
