import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TelemetryDrawer from "../src/features/test-panel/components/TelemetryDrawer";
import type { TelemetryRow } from "../src/lib/orch/telemetry";

describe("TelemetryDrawer", () => {
  it("should render empty timeline when rows is empty", () => {
    const { container } = render(<TelemetryDrawer rows={[]} />);
    expect(container.querySelector(".flex-1")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
  });

  it("should render timeline tab by default", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        agent: "agent-1",
        kind: "llm_input",
        title: "LLM in (gpt-4)",
        details: { model: "gpt-4" },
      },
    ];
    render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("Timeline")).toBeDefined();
    expect(screen.getByText("LLM in (gpt-4)")).toBeDefined();
  });

  it("should display row count", () => {
    const rows: TelemetryRow[] = [
      { id: "1", at: 1000, kind: "usage", title: "Usage" },
      { id: "2", at: 2000, kind: "usage", title: "Usage" },
      { id: "3", at: 3000, kind: "usage", title: "Usage" },
    ];
    render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("3")).toBeDefined();
  });

  it("should switch to raw tab when clicked", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "llm_input",
        title: "LLM in (gpt-4)",
        details: { model: "gpt-4" },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    const rawButton = screen.getByText("Raw");
    fireEvent.click(rawButton);
    
    // Raw tab should display JSON
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain('"id": "1"');
    expect(pre?.textContent).toContain('"kind": "llm_input"');
  });

  it("should display timestamp in timeline", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: new Date("2025-10-31T10:30:00").getTime(),
        kind: "usage",
        title: "Usage",
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    // Find the rounded border container for the row
    const rowContainer = container.querySelector(".rounded.border.border-neutral-800");
    const timeElement = rowContainer?.querySelector(".text-xs.opacity-60");
    expect(timeElement).toBeDefined();
    expect(timeElement?.textContent).toMatch(/\d+:\d+:\d+/);
  });

  it("should display agent name when present", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        agent: "agent-1",
        kind: "tool_call",
        title: "Tool call: search",
      },
    ];
    render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText(/agent-1/)).toBeDefined();
  });

  it("should display details as JSON when present", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "tool_call",
        title: "Tool call: search",
        details: { name: "search", args: { query: "test" } },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain('"name": "search"');
    expect(pre?.textContent).toContain('"query": "test"');
  });

  it("should apply error styling for error severity", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "error",
        title: "Error",
        severity: "error",
        details: { message: "Something failed" },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    const errorSpan = container.querySelector(".text-red-400");
    expect(errorSpan).toBeDefined();
    expect(errorSpan?.textContent).toBe("Error");
  });

  it("should apply warning styling for warn severity", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "warning",
        title: "Warning",
        severity: "warn",
        details: { message: "Rate limit approaching" },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    const warnSpan = container.querySelector(".text-yellow-300");
    expect(warnSpan).toBeDefined();
    expect(warnSpan?.textContent).toBe("Warning");
  });

  it("should apply default styling for info severity", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "usage",
        title: "Usage",
        severity: "info",
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    const infoSpan = container.querySelector(".text-neutral-100");
    expect(infoSpan).toBeDefined();
    expect(infoSpan?.textContent).toBe("Usage");
  });

  it("should limit displayed rows to last 200", () => {
    const rows: TelemetryRow[] = Array.from({ length: 250 }, (_, i) => ({
      id: `${i}`,
      at: i * 1000,
      kind: "usage" as const,
      title: `Usage ${i}`,
    }));
    
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    // Should show 200 in the counter
    expect(screen.getByText("200")).toBeDefined();
    
    // Should render 200 items
    const items = container.querySelectorAll(".rounded.border.border-neutral-800");
    expect(items.length).toBe(200);
  });

  it("should render multiple rows in timeline", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "llm_input",
        title: "LLM in (gpt-4)",
      },
      {
        id: "2",
        at: 2000,
        kind: "llm_output",
        title: "LLM out (gpt-4)",
      },
      {
        id: "3",
        at: 3000,
        kind: "tool_call",
        title: "Tool call: search",
      },
    ];
    render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("LLM in (gpt-4)")).toBeDefined();
    expect(screen.getByText("LLM out (gpt-4)")).toBeDefined();
    expect(screen.getByText("Tool call: search")).toBeDefined();
  });

  it("should handle rows without details", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "checkpoint",
        title: "Checkpoint",
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("Checkpoint")).toBeDefined();
    // Should not render details pre tag
    const detailsContainer = container.querySelector(".rounded.border.border-neutral-800");
    const pre = detailsContainer?.querySelector("pre");
    expect(pre).toBeNull();
  });

  it("should handle rows without agent", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "usage",
        title: "Usage",
        details: { tokens: { total: 100 } },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("Usage")).toBeDefined();
    const textDiv = container.querySelector(".text-sm");
    expect(textDiv?.textContent).not.toContain("—");
  });

  it("should toggle between timeline and raw tabs", () => {
    const rows: TelemetryRow[] = [
      {
        id: "1",
        at: 1000,
        kind: "usage",
        title: "Usage",
        details: { tokens: { total: 100 } },
      },
    ];
    const { container } = render(<TelemetryDrawer rows={rows} />);
    
    // Start on timeline
    expect(screen.getByText("Usage")).toBeDefined();
    
    // Click raw
    const rawButton = screen.getByText("Raw");
    fireEvent.click(rawButton);
    
    let pre = container.querySelector("pre");
    expect(pre?.textContent).toContain('"kind": "usage"');
    
    // Click back to timeline
    const timelineButton = screen.getByText("Timeline");
    fireEvent.click(timelineButton);
    
    expect(screen.getByText("Usage")).toBeDefined();
  });

  it("should render all telemetry kinds correctly", () => {
    const rows: TelemetryRow[] = [
      { id: "1", at: 1000, kind: "llm_input", title: "LLM in (gpt-4)" },
      { id: "2", at: 2000, kind: "llm_output", title: "LLM out (gpt-4)" },
      { id: "3", at: 3000, kind: "tool_call", title: "Tool call: search" },
      { id: "4", at: 4000, kind: "tool_result", title: "Tool result: search" },
      { id: "5", at: 5000, kind: "router_decision", title: "Router → agent-2" },
      { id: "6", at: 6000, kind: "checkpoint", title: "Checkpoint start" },
      { id: "7", at: 7000, kind: "usage", title: "Usage" },
      { id: "8", at: 8000, kind: "warning", title: "Warning", severity: "warn" },
      { id: "9", at: 9000, kind: "error", title: "Error", severity: "error" },
    ];
    render(<TelemetryDrawer rows={rows} />);
    
    expect(screen.getByText("LLM in (gpt-4)")).toBeDefined();
    expect(screen.getByText("LLM out (gpt-4)")).toBeDefined();
    expect(screen.getByText("Tool call: search")).toBeDefined();
    expect(screen.getByText("Tool result: search")).toBeDefined();
    expect(screen.getByText("Router → agent-2")).toBeDefined();
    expect(screen.getByText("Checkpoint start")).toBeDefined();
    expect(screen.getByText("Usage")).toBeDefined();
    expect(screen.getByText("Warning")).toBeDefined();
    expect(screen.getByText("Error")).toBeDefined();
  });
});
