import { renderHook, act, waitFor } from "@testing-library/react";
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

test("overlapping sends keep status with active stream", async () => {
  let releaseDelta: (() => void) | undefined;
  executeStreamMock
    .mockImplementationOnce(async function* (_body, options: { signal?: AbortSignal }) {
      const signal = options.signal;
      if (!signal) {
        return;
      }
      await new Promise((_, reject) => {
        const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
        if (signal.aborted) {
          reject(abortError);
          return;
        }
        signal.addEventListener("abort", () => reject(abortError), { once: true });
      });
    })
    .mockImplementationOnce(async function* () {
      yield { type: "response.created", run_id: "run-2" } satisfies ResponsesEvent;
      await new Promise<void>((resolve) => {
        releaseDelta = resolve;
      });
      yield { type: "response.output_text.delta", delta: "Hi" } satisfies ResponsesEvent;
      yield { type: "response.output_text.done" } satisfies ResponsesEvent;
      yield { type: "response.completed", status: "completed" } satisfies ResponsesEvent;
    });

  const { result } = renderHook(() => useResponsesStream());

  let firstSend: Promise<void> | undefined;
  let secondSend: Promise<void> | undefined;

  await act(async () => {
    firstSend = result.current.send({ nodes: [] }, "first", {});
    secondSend = result.current.send({ nodes: [] }, "second", {});
  });

  await waitFor(() => {
    expect(result.current.status).toBe("running");
    expect(releaseDelta).toBeTypeOf("function");
  });

  releaseDelta!();

  expect(secondSend).toBeDefined();
  await act(async () => {
    await secondSend!;
  });

  const awaitedFirst = firstSend;
  expect(awaitedFirst).toBeDefined();
  await awaitedFirst!;

  expect(result.current.status).toBe("done");
  expect(result.current.runId).toBe("run-2");
  const roles = result.current.messages.map((m) => m.role);
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
  const assistant = result.current.messages.find((m) => m.role === "assistant");
  expect(assistant?.text).toBe("Hi");
});

test("merges ui envelopes into assistant message widgets", async () => {
  collectEvents([
    { type: "response.created", run_id: "run-widgets" },
    {
      type: "response.output_text.delta",
      delta: "Here are ",
      ui: { kind: "citation-list", props: { items: [] } },
    },
    {
      type: "response.output_text.delta",
      delta: "citations",
      ui: { kind: "citation-list", props: { items: [{ url: "http://example.com", title: "Example" }] } },
    },
    { type: "response.output_text.done" },
    { type: "response.completed", status: "completed" },
  ]);

  const { result } = renderHook(() => useResponsesStream());

  await act(async () => {
    await result.current.send({ nodes: [] }, "search", {});
  });

  expect(result.current.messages).toHaveLength(2);
  const assistant = result.current.messages[1];
  expect(assistant?.role).toBe("assistant");
  expect(assistant?.text).toBe("Here are citations");
  expect(assistant?.widgets).toBeDefined();
  expect(assistant?.widgets).toHaveLength(1);
  expect(assistant?.widgets?.[0].kind).toBe("citation-list");
  expect(assistant?.widgets?.[0].props?.items).toHaveLength(1);
});

test("merges ui envelopes by kind and id", async () => {
  collectEvents([
    { type: "response.created", run_id: "run-widgets-id" },
    {
      type: "response.output_text.delta",
      delta: "Processing",
      ui: { kind: "key-value", id: "status", props: { entries: [{ key: "status", value: "pending" }] } },
    },
    {
      type: "response.output_text.delta",
      delta: "...",
      ui: { kind: "key-value", id: "status", props: { entries: [{ key: "status", value: "complete" }] } },
    },
    { type: "response.output_text.done" },
    { type: "response.completed", status: "completed" },
  ]);

  const { result } = renderHook(() => useResponsesStream());

  await act(async () => {
    await result.current.send({ nodes: [] }, "process", {});
  });

  const assistant = result.current.messages[1];
  expect(assistant?.widgets).toHaveLength(1);
  expect(assistant?.widgets?.[0].id).toBe("status");
  expect(assistant?.widgets?.[0].props?.entries).toHaveLength(1);
  const entries = assistant?.widgets?.[0].props?.entries as Array<{ key: string; value: string }>;
  expect(entries?.[0]?.value).toBe("complete");
});

test("handles multiple different widgets in same message", async () => {
  collectEvents([
    { type: "response.created", run_id: "run-multi-widgets" },
    {
      type: "response.output_text.delta",
      delta: "Results: ",
      ui: { kind: "table", props: { columns: ["Name"], rows: [] } },
    },
    {
      type: "response.output_text.delta",
      delta: "done",
      ui: { kind: "code", props: { content: "print('hello')", language: "python" } },
    },
    { type: "response.output_text.done" },
    { type: "response.completed", status: "completed" },
  ]);

  const { result } = renderHook(() => useResponsesStream());

  await act(async () => {
    await result.current.send({ nodes: [] }, "code", {});
  });

  const assistant = result.current.messages[1];
  expect(assistant?.widgets).toHaveLength(2);
  expect(assistant?.widgets?.[0].kind).toBe("table");
  expect(assistant?.widgets?.[1].kind).toBe("code");
});
