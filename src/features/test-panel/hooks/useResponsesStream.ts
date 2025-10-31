import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeStream } from "../../../lib/orch/client";
import {
  ChatMessage,
  ExecuteRequestBody,
  ResponsesEvent,
  WidgetEnvelope,
} from "../../../lib/orch/types";

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

function appendWidget(existing: ChatMessage, widget?: WidgetEnvelope): ChatMessage {
  if (!widget) {
    return existing;
  }
  const widgets = existing.widgets ? [...existing.widgets, widget] : [widget];
  return { ...existing, widgets };
}

export function useResponsesStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [usage, setUsage] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const upsertToolMessage = useCallback((evt: ResponsesEvent) => {
    if (evt.type !== "response.tool_result.created" && evt.type !== "response.tool_result.done" && evt.type !== "response.function_call_arguments.delta" && evt.type !== "response.function_call_arguments.done") {
      return;
    }

    setMessages((prev) => {
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

  const handleResponseEvent = useCallback((evt: ResponsesEvent) => {
    switch (evt.type) {
      case "response.created":
        runIdRef.current = evt.run_id ?? evt.id ?? null;
        break;

      case "response.output_text.delta":
        setMessages((prev) => {
          const now = Date.now();
          const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
          if (!last || last.role !== "assistant" || last.done) {
            const nextMessage: ChatMessage = appendWidget(
              {
                id: crypto.randomUUID(),
                role: "assistant",
                text: evt.delta,
                time: now,
                done: false,
              },
              evt.ui,
            );
            return [...prev, nextMessage];
          }

          const updated: ChatMessage = appendWidget(
            {
              ...last,
              text: (last.text ?? "") + evt.delta,
              time: now,
            },
            evt.ui,
          );
          return [...prev.slice(0, -1), updated];
        });
        break;

      case "response.output_text.done":
        setMessages((prev) => {
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
        upsertToolMessage(evt);
        break;

      case "response.completed":
        setStatus(evt.status === "paused" ? "paused" : "done");
        setUsage(evt.usage ?? null);
        break;

      case "response.error":
        setStatus("error");
        setError(evt.error?.message ?? "Unknown error");
        break;

      default:
        break;
    }
  }, [upsertToolMessage]);

  const send = useCallback(
    async (ir: unknown, userText: string, headers: SendHeaders = {}) => {
      if (!userText.trim()) {
        return;
      }

      abortRef.current?.abort();

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
          handleResponseEvent(evt);
        }
      } catch (err) {
        if (ctrl.signal.aborted || isAbortError(err)) {
          setStatus("idle");
          return;
        }
        setStatus("error");
        setError((err as { message?: string })?.message ?? String(err));
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
        }
      }
    },
    [handleResponseEvent],
  );

  const cancel = useCallback(() => {
    if (!abortRef.current) {
      return;
    }
    abortRef.current.abort();
    setStatus("idle");
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
