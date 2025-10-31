import { ResponsesEvent } from "./types";

export interface ParsedSSE {
  event?: string;
  data?: string;
}

/**
 * Iterates over a ReadableStream produced by fetch and yields parsed SSE frames.
 * We support POST streaming by reading directly from the body.
 */
export async function* sseIterator(stream: ReadableStream<Uint8Array>): AsyncGenerator<ParsedSSE> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitChunks = function* (flushRemainder = false): Generator<ParsedSSE> {
    let separatorIndex: number;
    const delimiter = "\n\n";

    while ((separatorIndex = buffer.indexOf(delimiter)) !== -1) {
      const raw = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + delimiter.length);
      const parsed = parseChunk(raw);
      if (parsed) {
        yield parsed;
      }
    }

    if (flushRemainder && buffer.trim().length > 0) {
      const parsed = parseChunk(buffer);
      buffer = "";
      if (parsed) {
        yield parsed;
      }
    }
  };

  const parseChunk = (chunk: string): ParsedSSE | null => {
    const lines = chunk.replace(/\r\n/g, "\n").split("\n");
    let event: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line) {
        continue;
      }
      if (line.startsWith(":")) {
        continue; // comment / heartbeat
      }
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        let value = line.slice(5);
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
        dataLines.push(value);
      }
    }

    if (!event && dataLines.length === 0) {
      return null;
    }

    return {
      event,
      data: dataLines.length > 0 ? dataLines.join("\n") : undefined,
    };
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      yield* emitChunks();
    }
    buffer += decoder.decode();
    yield* emitChunks(true);
  } finally {
    reader.releaseLock();
  }
}

export function parseResponsesEvent(sse: ParsedSSE): ResponsesEvent | null {
  if (!sse.data || sse.data === "[DONE]") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(sse.data);
  } catch {
    return null;
  }
  return isResponsesEvent(parsed) ? parsed : null;
}

function isResponsesEvent(value: unknown): value is ResponsesEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string") {
    return false;
  }

  switch (type) {
    case "response.created":
      return true;

    case "response.output_text.delta":
      return typeof record.delta === "string";

    case "response.output_text.done":
      return true;

    case "response.function_call_arguments.delta":
      return typeof record.name === "string" && typeof record.arguments === "string";

    case "response.function_call_arguments.done":
      return typeof record.name === "string";

    case "response.tool_result.created":
      return typeof record.name === "string" && (record.call_id === undefined || typeof record.call_id === "string");

    case "response.tool_result.done": {
      const hasName = typeof record.name === "string";
      const validCallId = record.call_id === undefined || typeof record.call_id === "string";
      const hasError =
        record.error === undefined ||
        (typeof record.error === "object" &&
          !!record.error &&
          typeof (record.error as Record<string, unknown>).code === "string" &&
          typeof (record.error as Record<string, unknown>).message === "string");
      return hasName && validCallId && hasError;
    }

    case "response.completed": {
      const status = record.status;
      const validStatus = status === "completed" || status === "paused";
      return validStatus;
    }

    case "response.error": {
      const err = record.error;
      if (!err || typeof err !== "object") {
        return false;
      }
      const errRecord = err as Record<string, unknown>;
      return typeof errRecord.code === "string" && typeof errRecord.message === "string";
    }

    default:
      return false;
  }
}
