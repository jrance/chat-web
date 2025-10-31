import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi, describe } from "vitest";
import type { ResponsesEvent, ResumePayload } from "../src/lib/orch/types";
import { useResponsesStream } from "../src/features/test-panel/hooks/useResponsesStream";

const { executeStreamMock, resumeStreamMock } = vi.hoisted(() => ({
  executeStreamMock: vi.fn(),
  resumeStreamMock: vi.fn(),
}));

vi.mock("../src/lib/orch/client", () => ({
  executeStream: executeStreamMock,
  resumeStream: resumeStreamMock,
}));

beforeEach(() => {
  executeStreamMock.mockReset();
  resumeStreamMock.mockReset();
});

const collectEvents = (events: ResponsesEvent[]) =>
  executeStreamMock.mockImplementation(async function* () {
    for (const evt of events) {
      yield evt;
    }
  });

const collectResumeEvents = (events: ResponsesEvent[]) =>
  resumeStreamMock.mockImplementation(async function* () {
    for (const evt of events) {
      yield evt;
    }
  });

describe("HITL pause and resume", () => {
  test("pause with router_choice and resume continues the stream", async () => {
    // Initial stream pauses with router choice
    collectEvents([
      { type: "response.created", run_id: "run-pause-1" },
      { type: "response.output_text.delta", delta: "I need clarification. " },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: {
          kind: "router_choice",
          targets: [
            { id: "route-a", label: "Option A" },
            { id: "route-b", label: "Option B" },
          ],
          message: "Which route should I take?",
        },
      },
    ]);

    // Resume stream continues and completes
    collectResumeEvents([
      { type: "response.output_text.delta", delta: "Taking route A. " },
      { type: "response.output_text.delta", delta: "Done!" },
      { type: "response.output_text.done" },
      { type: "response.completed", status: "completed" },
    ]);

    const { result } = renderHook(() => useResponsesStream());

    // Send initial message
    await act(async () => {
      await result.current.send({ nodes: [] }, "start task", {});
    });

    // Verify paused state with hitl
    expect(result.current.status).toBe("paused");
    expect(result.current.hitl).toBeDefined();
    expect((result.current.hitl as any)?.kind).toBe("router_choice");
    expect((result.current.hitl as any)?.targets).toHaveLength(2);

    // Resume with router choice
    const resumePayload: ResumePayload = {
      kind: "router_choice",
      choice: { target: "route-a" },
    };

    await act(async () => {
      await result.current.resume(resumePayload, {});
    });

    // Verify completion
    expect(resumeStreamMock).toHaveBeenCalledTimes(1);
    const [runId, payload] = resumeStreamMock.mock.calls[0] as [string, ResumePayload];
    expect(runId).toBe("run-pause-1");
    expect(payload).toEqual(resumePayload);

    expect(result.current.status).toBe("done");
    expect(result.current.hitl).toBeNull();
    expect(result.current.runId).toBe("run-pause-1");

    // Verify assistant message has complete text
    const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.text).toBe("I need clarification. Taking route A. Done!");
  });

  test("pause with user_message and resume continues the stream", async () => {
    // Initial stream pauses with clarification request
    collectEvents([
      { type: "response.created", run_id: "run-pause-2" },
      { type: "response.output_text.delta", delta: "Please provide more details. " },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: {
          kind: "user_message",
          message: "What additional information do you need?",
          placeholder: "Enter clarification...",
        },
      },
    ]);

    // Resume stream continues
    collectResumeEvents([
      { type: "response.output_text.delta", delta: "Thank you for clarifying. " },
      { type: "response.output_text.delta", delta: "Processing now." },
      { type: "response.output_text.done" },
      { type: "response.completed", status: "completed" },
    ]);

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "do something", {});
    });

    expect(result.current.status).toBe("paused");
    expect((result.current.hitl as any)?.kind).toBe("user_message");
    expect((result.current.hitl as any)?.placeholder).toBe("Enter clarification...");

    const resumePayload: ResumePayload = {
      kind: "user_message",
      message: "Here is the clarification you requested",
    };

    await act(async () => {
      await result.current.resume(resumePayload, {});
    });

    expect(result.current.status).toBe("done");
    expect(result.current.hitl).toBeNull();

    const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistantMessages[0]?.text).toBe("Please provide more details. Thank you for clarifying. Processing now.");
  });

  test("duplicate resume calls - opId guard prevents race condition", async () => {
    collectEvents([
      { type: "response.created", run_id: "run-race" },
      { type: "response.output_text.delta", delta: "Pausing... " },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "router_choice", targets: [{ id: "opt1" }] },
      },
    ]);

    let firstResumeRelease: (() => void) | undefined;
    let secondResumeRelease: (() => void) | undefined;

    // First resume hangs until we release it
    resumeStreamMock
      .mockImplementationOnce(async function* (_runId, _payload, options: { signal?: AbortSignal }) {
        await new Promise<void>((resolve, reject) => {
          firstResumeRelease = resolve;
          const signal = options.signal;
          if (signal) {
            if (signal.aborted) {
              reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
              return;
            }
            signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), {
              once: true,
            });
          }
        });
        yield { type: "response.output_text.delta", delta: "First resume (should be aborted)" } satisfies ResponsesEvent;
      })
      .mockImplementationOnce(async function* () {
        await new Promise<void>((resolve) => {
          secondResumeRelease = resolve;
        });
        yield { type: "response.output_text.delta", delta: "Second resume wins!" } satisfies ResponsesEvent;
        yield { type: "response.output_text.done" } satisfies ResponsesEvent;
        yield { type: "response.completed", status: "completed" } satisfies ResponsesEvent;
      });

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "pause me", {});
    });

    expect(result.current.status).toBe("paused");

    let firstResume: Promise<void> | undefined;
    let secondResume: Promise<void> | undefined;

    // Fire two resume calls
    await act(async () => {
      firstResume = result.current.resume({ kind: "router_choice", choice: { target: "opt1" } }, {});
      secondResume = result.current.resume({ kind: "router_choice", choice: { target: "opt1" } }, {});
    });

    // Wait for both to be in progress
    await waitFor(() => {
      expect(firstResumeRelease).toBeTypeOf("function");
      expect(secondResumeRelease).toBeTypeOf("function");
      expect(result.current.status).toBe("running");
    });

    // Release second resume first (it should win)
    secondResumeRelease!();

    await act(async () => {
      await secondResume!;
    });

    // First resume should have been aborted and not affect state
    firstResumeRelease!();
    await firstResume!;

    expect(result.current.status).toBe("done");
    expect(result.current.hitl).toBeNull();

    const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistantMessages[0]?.text).toContain("Second resume wins!");
    expect(assistantMessages[0]?.text).not.toContain("First resume");
  });

  test("cancel while paused clears hitl and returns to idle", async () => {
    collectEvents([
      { type: "response.created", run_id: "run-cancel-paused" },
      { type: "response.output_text.delta", delta: "Paused here." },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "router_choice", targets: [{ id: "choice1" }] },
      },
    ]);

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "pause", {});
    });

    expect(result.current.status).toBe("paused");
    expect(result.current.hitl).toBeDefined();

    // Cancel while paused
    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.hitl).toBeNull();
  });

  test("resume clears hitl even on immediate pause", async () => {
    collectEvents([
      { type: "response.created", run_id: "run-multi-pause" },
      { type: "response.output_text.delta", delta: "First pause. " },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "router_choice", targets: [{ id: "a" }] },
      },
    ]);

    collectResumeEvents([
      { type: "response.output_text.delta", delta: "Second pause. " },
      { type: "response.output_text.done" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "user_message", message: "More info needed" },
      },
    ]);

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "test", {});
    });

    expect(result.current.status).toBe("paused");
    const firstHitl = result.current.hitl;
    expect((firstHitl as any)?.kind).toBe("router_choice");

    await act(async () => {
      await result.current.resume({ kind: "router_choice", choice: { target: "a" } }, {});
    });

    // Should pause again with new hitl
    expect(result.current.status).toBe("paused");
    const secondHitl = result.current.hitl;
    expect((secondHitl as any)?.kind).toBe("user_message");
    expect(secondHitl).not.toBe(firstHitl);
  });

  test("resume handles errors and sets error state", async () => {
    collectEvents([
      { type: "response.created", run_id: "run-error-resume" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "router_choice", targets: [{ id: "x" }] },
      },
    ]);

    resumeStreamMock.mockImplementation(async function* () {
      yield { type: "response.error", error: { code: "RESUME_FAILED", message: "Resume service unavailable" } } satisfies ResponsesEvent;
    });

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "will pause", {});
    });

    expect(result.current.status).toBe("paused");

    await act(async () => {
      await result.current.resume({ kind: "router_choice", choice: { target: "x" } }, {});
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Resume service unavailable");
    expect(result.current.hitl).toBeNull();
  });

  test("resume throws error when no active runId", async () => {
    const { result } = renderHook(() => useResponsesStream());

    expect(result.current.status).toBe("idle");
    expect(result.current.runId).toBeNull();

    await expect(async () => {
      await act(async () => {
        await result.current.resume({ kind: "router_choice", choice: { target: "x" } }, {});
      });
    }).rejects.toThrow("No active runId to resume");
  });

  test("new send after pause clears hitl", async () => {
    collectEvents([
      { type: "response.created", run_id: "run-1" },
      {
        type: "response.completed",
        status: "paused",
        hitl: { kind: "router_choice", targets: [{ id: "opt" }] },
      },
    ]);

    const { result } = renderHook(() => useResponsesStream());

    await act(async () => {
      await result.current.send({ nodes: [] }, "first", {});
    });

    expect(result.current.status).toBe("paused");
    expect(result.current.hitl).toBeDefined();

    // Start a new send (should clear hitl)
    executeStreamMock.mockImplementation(async function* () {
      yield { type: "response.created", run_id: "run-2" } satisfies ResponsesEvent;
      yield { type: "response.output_text.delta", delta: "New run" } satisfies ResponsesEvent;
      yield { type: "response.output_text.done" } satisfies ResponsesEvent;
      yield { type: "response.completed", status: "completed" } satisfies ResponsesEvent;
    });

    await act(async () => {
      await result.current.send({ nodes: [] }, "second", {});
    });

    expect(result.current.status).toBe("done");
    expect(result.current.hitl).toBeNull();
    expect(result.current.runId).toBe("run-2");
  });
});
