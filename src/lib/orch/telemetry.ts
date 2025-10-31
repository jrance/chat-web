export type TelemetryRow = {
  id: string;
  at: number; // timestamp (ms)
  agent?: string;
  kind:
    | "llm_input"
    | "llm_output"
    | "tool_call"
    | "tool_result"
    | "router_decision"
    | "checkpoint"
    | "usage"
    | "warning"
    | "error";
  title: string; // short label for timeline
  details?: any; // safe JSON-ish blob for Raw
  severity?: "info" | "warn" | "error";
};

export function toRow(evt: any): TelemetryRow | null {
  if (!evt?.type?.startsWith?.("telemetry.")) return null;
  const t = evt.type.slice("telemetry.".length);
  const base = {
    id: crypto.randomUUID?.() ?? String(Math.random()),
    at: evt.at ?? Date.now(),
    agent: evt.agent,
  };
  switch (t) {
    case "llm_input":
      return {
        ...base,
        kind: "llm_input",
        title: `LLM in (${evt.model ?? "model"})`,
        details: pick(evt, ["prompt", "tokens_est", "redacted", "model"]),
      };
    case "llm_output":
      return {
        ...base,
        kind: "llm_output",
        title: `LLM out (${evt.model ?? "model"})`,
        details: pick(evt, ["text_sample", "tokens", "model"]),
      };
    case "tool_call":
      return {
        ...base,
        kind: "tool_call",
        title: `Tool call: ${evt.name}`,
        details: pick(evt, ["name", "args", "call_id", "redacted"]),
      };
    case "tool_result":
      return {
        ...base,
        kind: "tool_result",
        title: `Tool result: ${evt.name}`,
        details: pick(evt, ["name", "result", "call_id", "error"]),
      };
    case "router_decision":
      return {
        ...base,
        kind: "router_decision",
        title: `Router → ${evt.target}`,
        details: pick(evt, ["target", "confidence", "rationale"]),
      };
    case "checkpoint":
      return {
        ...base,
        kind: "checkpoint",
        title: `Checkpoint ${evt.kind ?? ""}`.trim(),
        details: pick(evt, ["kind", "id"]),
      };
    case "usage":
      return {
        ...base,
        kind: "usage",
        title: "Usage",
        details: pick(evt, ["tokens", "cost"]),
      };
    case "warning":
      return {
        ...base,
        kind: "warning",
        title: "Warning",
        details: pick(evt, ["message"]),
        severity: "warn",
      };
    case "error":
      return {
        ...base,
        kind: "error",
        title: "Error",
        details: pick(evt, ["message", "code"]),
        severity: "error",
      };
    default:
      return null;
  }
}

// tiny helper
function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}
