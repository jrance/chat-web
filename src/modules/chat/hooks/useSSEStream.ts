import { useCallback, useRef, useState } from "react";
import { USE_MOCK_CHAT } from "../config/chatConfig";
import { mockSubscribe } from "../mocks/mockChat";

type Handler = (type: string, data: unknown, id?: string) => void;

type StreamControls = {
  open: (handler: Handler) => (() => void) | undefined;
  close: () => void;
  connected: boolean;
};

function extractRunId(url: string): string | undefined {
  const match = url.match(/\/runs\/([^/]+)\/stream$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function useSSEStream(url?: string, lastEventId?: string): StreamControls {
  const [connected, setConnected] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const open = useCallback(
    (handler: Handler) => {
      if (!url) return undefined;

      if (USE_MOCK_CHAT) {
        const runId = extractRunId(url);
        if (!runId) return undefined;
        setConnected(true);
        const teardown = mockSubscribe(runId, (type, data, id) => {
          handler(type, data, id);
          if (type === "completed" || type === "error") {
            setConnected(false);
          }
        });
        return () => {
          teardown?.();
          setConnected(false);
        };
      }

      controller.current = new AbortController();

      const finalUrl = lastEventId
        ? `${url}${url.includes("?") ? "&" : "?"}lastEventId=${encodeURIComponent(lastEventId)}`
        : url;

      const eventSource = new EventSource(finalUrl, { withCredentials: true });
      eventSource.onopen = () => setConnected(true);
      eventSource.onerror = () => setConnected(false);
      eventSource.onmessage = (event) => handler("message", event.data ? JSON.parse(event.data as string) : null, event.lastEventId || undefined);

      const forward = (type: string) => (event: MessageEvent) => handler(type, JSON.parse(event.data), (event as MessageEvent & { lastEventId?: string }).lastEventId);

      [
        "session.started",
        "schema",
        "message.delta",
        "json.patch",
        "json.done",
        "tool.requested",
        "tool.result",
        "checkpointed",
        "status",
        "warning",
        "error",
        "completed",
        "history.sync",
      ].forEach((eventType) => eventSource.addEventListener(eventType, forward(eventType)));

      return () => {
        eventSource.close();
        setConnected(false);
      };
    },
    [lastEventId, url]
  );

  const close = useCallback(() => {
    if (USE_MOCK_CHAT) {
      setConnected(false);
      return;
    }
    controller.current?.abort();
    setConnected(false);
  }, []);

  return { open, close, connected };
}
