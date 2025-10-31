import { renderHook, act } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { ResponsesEvent } from "../src/lib/orch/types";
import { useResponsesStream } from "../src/features/test-panel/hooks/useResponsesStream";

const { executeStreamMock } = vi.hoisted(() => ({
  executeStreamMock: vi.fn(),
}));

vi.mock("../src/lib/orch/client", () => ({
  executeStream: executeStreamMock,
}));

beforeEach(() => {
  executeStreamMock.mockReset();
});

const collectEvents = (events: ResponsesEvent[]) =>
  executeStreamMock.mockImplementation(async function* () {
    for (const evt of events) {
      yield evt;
    }
  });

test("send streams assistant deltas and tool results", async () => {
  collectEvents([
    { type: "response.created", run_id: "run-1" },
    { type: "response.output_text.delta", delta: "Hel" },
    { type: "response.output_text.delta", delta: "lo" },
    { type: "response.output_text.done" },
    { type: "response.tool_result.created", name: "web-search", call_id: "call-1" },
    { type: "response.tool_result.done", name: "web-search", call_id: "call-1", result: { hits: 3 } },
    { type: "response.completed", status: "completed" },
  ]);

  const { result } = renderHook(() => useResponsesStream());

  await act(async () => {
    await result.current.send({ nodes: [] }, "hello", { Authorization: "Bearer token" });
  });

  expect(executeStreamMock).toHaveBeenCalledTimes(1);
  const [, options] = executeStreamMock.mock.calls[0] as [unknown, { headers?: Record<string, string> }];
  expect(options.headers).toMatchObject({
    Authorization: "Bearer token",
  });

  expect(result.current.runId).toBe("run-1");
  expect(result.current.status).toBe("done");
  expect(result.current.messages).toHaveLength(3);
  const [, assistant, tool] = result.current.messages;
  expect(assistant?.role).toBe("assistant");
  expect(assistant?.text).toBe("Hello");
  expect(assistant?.done).toBe(true);
  expect(tool?.role).toBe("tool");
  expect(tool?.tool).toMatchObject({ name: "web-search", result: { hits: 3 } });
  expect(tool?.done).toBe(true);
});

test("cancel aborts the stream and resets status", async () => {
  executeStreamMock.mockImplementation(async function* (_body, options: { signal?: AbortSignal }) {
    yield { type: "response.created", run_id: "run-cancel" } satisfies ResponsesEvent;
    const signal = options.signal;
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    }
    await new Promise<never>((_, reject) => {
      const listener = () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      signal.addEventListener("abort", listener, { once: true });
    });
  });

  const { result } = renderHook(() => useResponsesStream());

  let sendPromise: Promise<void> | undefined;
  act(() => {
    sendPromise = result.current.send({ nodes: [] }, "cancel me", {});
  });

  await act(async () => {
    result.current.cancel();
    expect(sendPromise).toBeDefined();
    await sendPromise!;
  });

  expect(result.current.status).toBe("idle");
  expect(result.current.error).toBeNull();
  expect(result.current.runId).toBe("run-cancel");
});
