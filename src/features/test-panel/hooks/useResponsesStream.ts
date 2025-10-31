import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeStream } from "../../../lib/orch/client";
import {
  ChatMessage,
  ExecuteRequestBody,
  ResponsesEvent,
  WidgetEnvelope,
} from "../../../lib/orch/types";
import { mergeEnvelopes } from "../../../lib/widgets/merge";

export type StreamStatus = "idle" | "running" | "paused" | "done" | "error";

type SendHeaders = Record<string, string>;

const isAbortError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (typeof error === "object" && "name" in error) {
    return (error as { name?: unknown }).name === "AbortError";
  }
  return false;
};

export function useResponsesStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [usage, setUsage] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const opRef = useRef(0);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        opRef.current += 1;
        try {
          abortRef.current.abort("unmount");
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const upsertToolMessage = useCallback((evt: ResponsesEvent, opId: number) => {
    if (
      evt.type !== "response.tool_result.created" &&
      evt.type !== "response.tool_result.done" &&
      evt.type !== "response.function_call_arguments.delta" &&
      evt.type !== "response.function_call_arguments.done"
    ) {
      return;
    }

    setMessages((prev) => {
      if (opRef.current !== opId) {
        return prev;
      }

      const key = evt.type.startsWith("response.tool_result") ? evt.call_id ?? evt.name : evt.name;
      const now = Date.now();
      const next = [...prev];
      let targetIndex = -1;

      for (let i = next.length - 1; i >= 0; i -= 1) {
        const candidate = next[i];
        const candidateKey = candidate.tool?.callId || candidate.tool?.name;
        if (candidate.role === "tool" && candidateKey === key) {
          targetIndex = i;
          break;
        }
      }

      const ensureMessage = (): number => {
        if (targetIndex !== -1) {
          return targetIndex;
        }
        const toolMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "tool",
          text: undefined,
          tool: { name: evt.name, callId: evt.call_id },
          time: now,
          done: false,
        };
        next.push(toolMessage);
        targetIndex = next.length - 1;
        return targetIndex;
      };

      const index = ensureMessage();
      const current = next[index];

      if (evt.type === "response.tool_result.created") {
        next[index] = {
          ...current,
          time: now,
          tool: { name: evt.name, callId: evt.call_id },
          done: false,
        };
        return next;
      }

      if (evt.type === "response.tool_result.done") {
        next[index] = {
          ...current,
          time: now,
          tool: {
            name: evt.name,
            callId: evt.call_id,
            result: evt.result,
            error: evt.error,
          },
          done: true,
        };
        return next;
      }

      if (evt.type === "response.function_call_arguments.delta") {
        const text = (current.text ?? "") + evt.arguments;
        next[index] = {
          ...current,
          time: now,
          text,
          tool: { name: evt.name, callId: current.tool?.callId },
          done: false,
        };
        return next;
      }

      // response.function_call_arguments.done
      next[index] = {
        ...current,
        time: now,
        done: true,
      };
      return next;
    });
  }, []);

  const handleResponseEvent = useCallback(
    (evt: ResponsesEvent, opId: number) => {
      switch (evt.type) {
        case "response.created":
          if (opRef.current !== opId) {
            return;
          }
          runIdRef.current = evt.run_id ?? evt.id ?? null;
          break;

        case "response.output_text.delta":
          setMessages((prev) => {
            if (opRef.current !== opId) {
              return prev;
            }
            const now = Date.now();
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (!last || last.role !== "assistant" || last.done) {
              const nextMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                text: evt.delta,
                time: now,
                done: false,
                widgets: evt.ui ? [evt.ui] : undefined,
              };
              return [...prev, nextMessage];
            }

            const updated: ChatMessage = {
              ...last,
              text: (last.text ?? "") + evt.delta,
              time: now,
              widgets: mergeEnvelopes(last.widgets || [], evt.ui),
            };
            return [...prev.slice(0, -1), updated];
          });
          break;

        case "response.output_text.done":
          setMessages((prev) => {
            if (opRef.current !== opId) {
              return prev;
            }
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (!last || last.role !== "assistant" || last.done) {
              return prev;
            }
            const updated: ChatMessage = { ...last, done: true };
            return [...prev.slice(0, -1), updated];
          });
          break;

        case "response.function_call_arguments.delta":
        case "response.function_call_arguments.done":
        case "response.tool_result.created":
        case "response.tool_result.done":
          upsertToolMessage(evt, opId);
          break;

        case "response.completed":
          if (opRef.current !== opId) {
            return;
          }
          setStatus(evt.status === "paused" ? "paused" : "done");
          setUsage(evt.usage ?? null);
          break;

        case "response.error":
          if (opRef.current !== opId) {
            return;
          }
          setStatus("error");
          setError(evt.error?.message ?? "Unknown error");
          break;

        default:
          break;
      }
    },
    [upsertToolMessage],
  );

  const send = useCallback(
    async (ir: unknown, userText: string, headers: SendHeaders = {}) => {
      if (!userText.trim()) {
        return;
      }

      const opId = opRef.current + 1;
      const previousController = abortRef.current;
      opRef.current = opId;

      if (previousController) {
        try {
          previousController.abort("replaced");
        } catch {
          // ignore
        }
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      runIdRef.current = null;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: userText,
        time: Date.now(),
        done: true,
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus("running");
      setError(null);
      setUsage(null);

      const body: ExecuteRequestBody = {
        ir,
        input: { text: userText },
      };

      try {
        for await (const evt of executeStream(body, { headers, signal: ctrl.signal })) {
          if (opRef.current !== opId) {
            break;
          }
          handleResponseEvent(evt, opId);
        }
      } catch (err) {
        if (opRef.current !== opId) {
          return;
        }
        if (ctrl.signal.aborted || isAbortError(err)) {
          setStatus("idle");
        } else {
          setStatus("error");
          setError((err as { message?: string })?.message ?? String(err));
        }
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
        }
        if (opRef.current === opId && !ctrl.signal.aborted) {
          setStatus((prev) => (prev === "running" ? "idle" : prev));
        }
      }
    },
    [handleResponseEvent],
  );

  const cancel = useCallback(() => {
    if (!abortRef.current) {
      return;
    }
    try {
      abortRef.current.abort("user-cancel");
    } catch {
      // ignore
    }
  }, []);

  return useMemo(
    () => ({
      runId: runIdRef.current,
      messages,
      status,
      usage,
      error,
      send,
      cancel,
    }),
    [messages, status, usage, error, send, cancel],
  );
}
