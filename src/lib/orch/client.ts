import { API_BASE } from "../../app/config";
import { parseResponsesEvent, sseIterator } from "./sse";
import { ExecuteOptions, ExecuteRequestBody, ResponsesEvent } from "./types";

const STREAM_PATH = "/v1/execute/stream";

let orchestratorBase = trimTrailingSlash(API_BASE);

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function setOrchestratorBase(baseUrl: string): void {
  orchestratorBase = trimTrailingSlash(baseUrl);
}

export function getOrchestratorBase(): string {
  return orchestratorBase;
}

export function getExecuteStreamUrl(baseOverride?: string): string {
  const base = trimTrailingSlash(baseOverride ?? orchestratorBase);
  return `${base}${STREAM_PATH}`;
}

export async function* executeStream(body: ExecuteRequestBody, options: ExecuteOptions = {}): AsyncGenerator<ResponsesEvent> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(getExecuteStreamUrl(options.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText || "Unknown error");
    throw new Error(`Stream request failed (${response.status}): ${message}`);
  }

  if (!response.body) {
    throw new Error("Stream response did not include a body.");
  }

  for await (const sse of sseIterator(response.body)) {
    const evt = parseResponsesEvent(sse);
    if (evt) {
      yield evt;
    }
  }
}
