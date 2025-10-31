import { describe, it, expect } from "vitest";
import { toRow } from "../src/lib/orch/telemetry";

describe("telemetry.parser", () => {
  it("should return null for non-telemetry events", () => {
    expect(toRow(null)).toBeNull();
    expect(toRow({})).toBeNull();
    expect(toRow({ type: "response.created" })).toBeNull();
    expect(toRow({ type: "some.other.event" })).toBeNull();
  });

  it("should normalize telemetry.llm_input", () => {
    const evt = {
      type: "telemetry.llm_input",
      at: 1000,
      agent: "agent-1",
      model: "gpt-4",
      prompt: "Hello world",
      tokens_est: 10,
      redacted: false,
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("llm_input");
    expect(row?.title).toBe("LLM in (gpt-4)");
    expect(row?.at).toBe(1000);
    expect(row?.agent).toBe("agent-1");
    expect(row?.details).toEqual({
      prompt: "Hello world",
      tokens_est: 10,
      redacted: false,
      model: "gpt-4",
    });
  });

  it("should normalize telemetry.llm_output", () => {
    const evt = {
      type: "telemetry.llm_output",
      at: 2000,
      agent: "agent-1",
      model: "gpt-4",
      text_sample: "Hello back",
      tokens: { input: 10, output: 5, total: 15 },
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("llm_output");
    expect(row?.title).toBe("LLM out (gpt-4)");
    expect(row?.details).toEqual({
      text_sample: "Hello back",
      tokens: { input: 10, output: 5, total: 15 },
      model: "gpt-4",
    });
  });

  it("should normalize telemetry.tool_call", () => {
    const evt = {
      type: "telemetry.tool_call",
      at: 3000,
      agent: "agent-1",
      name: "search",
      args: { query: "test" },
      call_id: "call-123",
      redacted: false,
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("tool_call");
    expect(row?.title).toBe("Tool call: search");
    expect(row?.details).toEqual({
      name: "search",
      args: { query: "test" },
      call_id: "call-123",
      redacted: false,
    });
  });

  it("should normalize telemetry.tool_result", () => {
    const evt = {
      type: "telemetry.tool_result",
      at: 4000,
      agent: "agent-1",
      name: "search",
      result: { items: [1, 2, 3] },
      call_id: "call-123",
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("tool_result");
    expect(row?.title).toBe("Tool result: search");
    expect(row?.details).toEqual({
      name: "search",
      result: { items: [1, 2, 3] },
      call_id: "call-123",
    });
  });

  it("should normalize telemetry.tool_result with error", () => {
    const evt = {
      type: "telemetry.tool_result",
      at: 4500,
      agent: "agent-1",
      name: "search",
      call_id: "call-123",
      error: { code: "TIMEOUT", message: "Request timed out" },
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("tool_result");
    expect(row?.details).toEqual({
      name: "search",
      call_id: "call-123",
      error: { code: "TIMEOUT", message: "Request timed out" },
    });
  });

  it("should normalize telemetry.router_decision", () => {
    const evt = {
      type: "telemetry.router_decision",
      at: 5000,
      agent: "agent-1",
      target: "tool-agent",
      confidence: 0.95,
      rationale: "User asked for a search",
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("router_decision");
    expect(row?.title).toBe("Router → tool-agent");
    expect(row?.details).toEqual({
      target: "tool-agent",
      confidence: 0.95,
      rationale: "User asked for a search",
    });
  });

  it("should normalize telemetry.checkpoint", () => {
    const evt = {
      type: "telemetry.checkpoint",
      at: 6000,
      agent: "agent-1",
      kind: "before-tool",
      id: "cp-123",
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("checkpoint");
    expect(row?.title).toBe("Checkpoint before-tool");
    expect(row?.details).toEqual({
      kind: "before-tool",
      id: "cp-123",
    });
  });

  it("should normalize telemetry.usage", () => {
    const evt = {
      type: "telemetry.usage",
      at: 7000,
      agent: "agent-1",
      tokens: { input: 100, output: 50, total: 150 },
      cost: 0.003,
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("usage");
    expect(row?.title).toBe("Usage");
    expect(row?.details).toEqual({
      tokens: { input: 100, output: 50, total: 150 },
      cost: 0.003,
    });
  });

  it("should normalize telemetry.warning", () => {
    const evt = {
      type: "telemetry.warning",
      at: 8000,
      agent: "agent-1",
      message: "Rate limit approaching",
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("warning");
    expect(row?.title).toBe("Warning");
    expect(row?.severity).toBe("warn");
    expect(row?.details).toEqual({
      message: "Rate limit approaching",
    });
  });

  it("should normalize telemetry.error", () => {
    const evt = {
      type: "telemetry.error",
      at: 9000,
      agent: "agent-1",
      message: "Tool execution failed",
      code: "TOOL_ERROR",
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("error");
    expect(row?.title).toBe("Error");
    expect(row?.severity).toBe("error");
    expect(row?.details).toEqual({
      message: "Tool execution failed",
      code: "TOOL_ERROR",
    });
  });

  it("should return null for unknown telemetry type", () => {
    const evt = {
      type: "telemetry.unknown_type",
      at: 10000,
    };
    const row = toRow(evt);
    expect(row).toBeNull();
  });

  it("should use Date.now() if at is missing", () => {
    const before = Date.now();
    const row = toRow({ type: "telemetry.usage", tokens: {} });
    const after = Date.now();
    expect(row).toBeTruthy();
    expect(row!.at).toBeGreaterThanOrEqual(before);
    expect(row!.at).toBeLessThanOrEqual(after);
  });

  it("should handle missing optional fields", () => {
    const row = toRow({ type: "telemetry.llm_input" });
    expect(row).toBeTruthy();
    expect(row?.title).toBe("LLM in (model)");
    expect(row?.agent).toBeUndefined();
    expect(row?.details).toEqual({});
  });

  it("should tolerate extra fields", () => {
    const evt = {
      type: "telemetry.llm_input",
      model: "gpt-4",
      extra_field: "ignored",
      another_field: 123,
    };
    const row = toRow(evt);
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("llm_input");
    // extra fields are not in details
    expect(row?.details).toEqual({ model: "gpt-4" });
  });

  it("should generate unique IDs for each row", () => {
    const evt1 = { type: "telemetry.usage" };
    const evt2 = { type: "telemetry.usage" };
    const row1 = toRow(evt1);
    const row2 = toRow(evt2);
    expect(row1?.id).toBeTruthy();
    expect(row2?.id).toBeTruthy();
    expect(row1?.id).not.toBe(row2?.id);
  });
});
