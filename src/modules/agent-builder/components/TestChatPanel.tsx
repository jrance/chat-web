import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { executeOnceWithMessages, executeStreamWithMessages } from "../data/orchestratorApi";

type ChatMsg = { role: "user" | "assistant" | "tool"; content: string };

export default function TestChatPanel({ autoFocus }: { autoFocus?: boolean } = {}): JSX.Element {
  const { state } = useAgentBuilder();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canRun = useMemo(() => Boolean(state.ir?.nodes?.length), [state.ir?.nodes?.length]);

  const append = useCallback((m: ChatMsg) => setMsgs((prev) => [...prev, m]), []);
  const updateLastAssistant = useCallback((delta: string) => {
    setMsgs((prev) => {
      const next = [...prev];
      const idx = next.map((m) => m.role).lastIndexOf("assistant");
      if (idx >= 0) next[idx] = { ...next[idx], content: (next[idx].content || "") + delta };
      return next;
    });
  }, []);

  const runStream = useCallback(async () => {
    if (!input.trim()) return;
    const history = [...msgs, { role: "user", content: input }];
    setMsgs(history);
    setInput("");
    setStreaming(true);
    append({ role: "assistant", content: "" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await executeStreamWithMessages(state.ir, history, (evt) => {
        const t = evt?.type as string | undefined;
        if (!t) return;
        if (t === "content.delta") updateLastAssistant(String(evt.text_delta ?? ""));
        if (t === "role" && evt.role === "assistant") {
          // assistant placeholder already added
        }
        if (t === "tool_call.start") {
          updateLastAssistant(`\n[Tool: ${evt.tool_name}]\n`);
        }
        if (t === "message.end") {
          setStreaming(false);
        }
        if (t === "error") {
          updateLastAssistant(`\n[error] ${evt?.error?.message || "unknown"}`);
          setStreaming(false);
        }
      }, ctrl.signal);
    } catch (e: any) {
      setStreaming(false);
      updateLastAssistant(`\n[stream error] ${e?.message || e}`);
    }
  }, [append, input, msgs, state.ir, updateLastAssistant]);

  const runOnce = useCallback(async () => {
    if (!input.trim()) return;
    const history = [...msgs, { role: "user", content: input }];
    setMsgs(history);
    setStreaming(true);
    try {
      const res = await executeOnceWithMessages(state.ir, history);
      const last = Array.isArray(res?.messages) ? res.messages[res.messages.length - 1] : null;
      const content = (typeof last?.content === "string") ? last.content : JSON.stringify(last?.content ?? {});
      append({ role: "assistant", content: content || "" });
    } catch (e: any) {
      append({ role: "assistant", content: `[error] ${e?.message || e}` });
    } finally {
      setStreaming(false);
      setInput("");
    }
  }, [append, input, msgs, state.ir]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMsgs([]);
    setInput("");
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  return (
    <div className="ab-testchat">
      <div className="ab-testchat__header">
        <strong>Test Chat</strong>
        <button className="ab-btn ab-btn--outline" onClick={clear} disabled={streaming || msgs.length === 0}>Clear</button>
      </div>
      <div className="ab-testchat__messages" aria-live="polite" ref={scrollRef}>
        {msgs.length === 0 && <div className="ab-help">Type a prompt and run a streaming test against the current configuration.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`ab-msg ab-msg--${m.role}`}>
            <div className="ab-msg__role">{m.role}</div>
            <div className="ab-msg__content">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="ab-testchat__composer">
        <input
          type="text"
          placeholder="Ask something…"
          value={input}
          ref={inputRef}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runStream();
          }}
          disabled={!canRun || streaming}
        />
        <button className="ab-btn ab-btn--primary" onClick={runStream} disabled={!canRun || streaming || !input.trim()}>
          {streaming ? "Streaming…" : "Run (stream)"}
        </button>
        <button className="ab-btn" onClick={runOnce} disabled={!canRun || streaming || !input.trim()}>Run (non‑stream)</button>
        <button className="ab-btn ab-btn--outline" onClick={stop} disabled={!streaming}>Stop</button>
      </div>
      <style>{`
        .ab-testchat__header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .ab-testchat__messages { max-height: 320px; overflow: auto; border: 1px solid #eee; padding: 8px; border-radius: 6px; background: #fafafa; }
        .ab-msg { margin-bottom: 8px; display: grid; grid-template-columns: 80px 1fr; gap: 8px; }
        .ab-msg__role { text-transform: capitalize; color: #666; font-size: 12px; }
        .ab-msg__content { white-space: pre-wrap; font-family: ui-sans-serif, system-ui; }
        .ab-testchat__composer { display: flex; gap: 8px; margin-top: 8px; }
        .ab-testchat__composer input { flex: 1; }
      `}</style>
    </div>
  );
}

