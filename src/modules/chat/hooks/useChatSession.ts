import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchHistory, sendMessage, cancelRun } from "../data/chatRepository";
import { useSSEStream } from "./useSSEStream";
import { initState, applyEvent, TranscriptState } from "../normalizers/sseNormalizer";
import type { Paged, HistoryItem } from "../model/types";
import { streamUrl, USE_MOCK_CHAT } from "../config/chatConfig";

export function useChatSession(tenantId: string, sessionId: string) {
  const [hist, setHist] = useState<HistoryItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [runId, setRunId] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<TranscriptState>(initState());
  const lastEventId = useRef<string | undefined>(undefined);
  const { open, close, connected } = useSSEStream(runId ? streamUrl(tenantId, sessionId, runId) : undefined, lastEventId.current);
  const historyRequestRef = useRef(0);

  const applyHistory = useCallback(
    (page: Paged<HistoryItem>, mode: "replace" | "prepend" = "replace") => {
      setHasMore(!!page.nextCursor);
      setCursor(page.nextCursor || undefined);
      if (mode === "replace") {
        setHist(page.items);
        return;
      }
      setHist((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const merged = [...page.items.filter((item) => !ids.has(item.id)), ...prev];
        return merged;
      });
    },
    []
  );

  const fetchAndUpdateHistory = useCallback(
    async (fetchCursor?: string, mode: "replace" | "prepend" = "replace") => {
      const requestId = ++historyRequestRef.current;
      const page = await fetchHistory(tenantId, sessionId, fetchCursor);
      if (historyRequestRef.current === requestId) {
        applyHistory(page, mode);
      }
      return page;
    },
    [applyHistory, sessionId, tenantId]
  );

  useEffect(() => {
    fetchAndUpdateHistory().catch(() => setStatus("error"));
  }, [fetchAndUpdateHistory]);

  const handleEvent = useCallback(
    (type: string, data: unknown, id?: string) => {
      if (type === "history.sync") {
        const page = (data as Paged<HistoryItem>) ?? { items: [], nextCursor: null };
        applyHistory(page, "replace");
        setTranscript(initState());
        setStatus("idle");
        setRunId(null);
        return;
      }

      setTranscript((prev) => applyEvent(prev, type, data, id));
      if (id) {
        lastEventId.current = id;
      }

      if (type === "completed" || type === "error") {
        setStatus(type === "completed" ? "idle" : "error");
        setRunId(null);
        if (!USE_MOCK_CHAT) {
          fetchAndUpdateHistory().finally(() => setTranscript(initState()));
        } else {
          setTranscript(initState());
        }
      }
    },
    [applyHistory, fetchAndUpdateHistory]
  );

  useEffect(() => {
    if (!runId) return;
    setStatus("busy");
    const teardown = open((type, data, id) => {
      handleEvent(type, data, id);
    });
    return () => {
      teardown?.();
      setStatus("idle");
    };
  }, [handleEvent, open, runId]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    await fetchAndUpdateHistory(cursor, "prepend");
  }, [cursor, fetchAndUpdateHistory, hasMore]);

  const send = useCallback(
    async (text: string, agentId?: string) => {
      const { runId: newRun } = await sendMessage(tenantId, { sessionId, text, agentId });
      if (USE_MOCK_CHAT) {
        fetchAndUpdateHistory().catch(() => undefined);
      }
      setRunId(newRun);
    },
    [fetchAndUpdateHistory, sessionId, tenantId]
  );

  const cancel = useCallback(async () => {
    if (!runId) return;
    await cancelRun(tenantId, runId);
    close();
    setRunId(null);
  }, [close, runId, tenantId]);

  const turns = useMemo(() => [...hist, ...transcript.turns], [hist, transcript]);

  return { turns, status, send, cancel, loadMore, hasMore, connected };
}
