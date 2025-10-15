import { IRGraph } from "../model/ir";
import { compileUrl, executeUrl, executeStreamUrl, type CompileResponse } from "../config/orchestratorConfig";

export async function compileGraph(ir: IRGraph): Promise<CompileResponse> {
  const res = await fetch(compileUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ir),
  });

  // Try to parse JSON either way for useful error feedback
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore, we'll throw below if not ok
  }

  if (!res.ok) {
    const detail = payload?.detail || payload?.message || res.statusText;
    throw new Error(`Compile failed (${res.status}): ${detail}`);
  }

  return (payload ?? {}) as CompileResponse;
}

export async function executeOnce(ir: IRGraph, text: string): Promise<any> {
  const res = await fetch(executeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: ir, input: { text } }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.detail || res.statusText || "Execute failed");
  }
  return payload;
}

export type OrchestratorSSEHandler = (event: any) => void;

// Open a POST stream to /execute/stream and parse SSE frames manually.
export async function executeStream(ir: IRGraph, text: string, handler: OrchestratorSSEHandler, signal?: AbortSignal): Promise<void> {
  const res = await fetch(executeStreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: ir, input: { text } }),
    signal,
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Stream failed (${res.status}): ${msg}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    // Parse SSE frames separated by double newlines
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      // Extract data: lines and join
      const dataLines = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (!dataLines.length) continue;
      const dataStr = dataLines.join("\n");
      try {
        const obj = JSON.parse(dataStr);
        handler(obj);
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

// Multi-turn helpers using explicit messages array
export async function executeOnceWithMessages(ir: IRGraph, messages: { role: string; content: string }[]): Promise<any> {
  const res = await fetch(executeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: ir, input: { messages } }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.detail || res.statusText || "Execute failed");
  }
  return payload;
}

export async function executeStreamWithMessages(
  ir: IRGraph,
  messages: { role: string; content: string }[],
  handler: OrchestratorSSEHandler,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(executeStreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: ir, input: { messages } }),
    signal,
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Stream failed (${res.status}): ${msg}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (!dataLines.length) continue;
      const dataStr = dataLines.join("\n");
      try {
        const obj = JSON.parse(dataStr);
        handler(obj);
      } catch {
        // ignore
      }
    }
  }
}
