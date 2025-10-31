import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setOrchestratorBase } from "../../../lib/orch/client";
import { useResponsesStream } from "../hooks/useResponsesStream";
import TestChatMessage from "./TestChatMessage";

type TestChatPaneProps = {
  ir: unknown;
  tenantId: string;
  authToken?: string;
  baseUrl: string;
  autoFocus?: boolean;
  canRun: boolean;
};

type InnerProps = TestChatPaneProps & {
  onReset: () => void;
};

const buildHeaders = (tenantId: string, authToken?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-Tenant-ID": tenantId,
    "X-Request-ID": crypto.randomUUID(),
    "X-Correlation-ID": crypto.randomUUID(),
    "X-Telemetry": "none",
  };
  if (authToken) {
    headers.Authorization = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }
  return headers;
};

export default function TestChatPane(props: TestChatPaneProps) {
  const [sessionKey, setSessionKey] = useState(0);

  const handleReset = useCallback(() => {
    setSessionKey((key) => key + 1);
  }, []);

  return <TestChatPaneInner key={sessionKey} {...props} onReset={handleReset} />;
}

function TestChatPaneInner({ ir, tenantId, authToken, baseUrl, autoFocus, canRun, onReset }: InnerProps) {
  const [input, setInput] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { runId, messages, status, usage, error, send, cancel } = useResponsesStream();

  useEffect(() => {
    setOrchestratorBase(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    if (autoFocus) {
      editorRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!canRun || !input.trim()) {
      return;
    }
    send(ir, input, buildHeaders(tenantId, authToken));
    setInput("");
  }, [authToken, canRun, input, ir, send, tenantId]);

  const canSend = input.trim().length > 0 && status !== "running" && canRun;

  const statusLabel = useMemo(() => {
    switch (status) {
      case "running":
        return "Running";
      case "paused":
        return "Paused (resume in orchestration engine)";
      case "done":
        return "Completed";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  }, [status]);

  return (
    <div className="ab-testchat">
      <div className="ab-testchat__header">
        <div>
          <strong>Test Chat</strong>
          <div className="ab-testchat__status" aria-live="polite">
            <span>{statusLabel}</span>
            {runId && <span className="ab-testchat__run">Run: {runId}</span>}
          </div>
        </div>
        <div className="ab-testchat__actions">
          <button className="ab-btn ab-btn--outline" onClick={onReset} disabled={status === "running" || messages.length === 0}>
            Clear
          </button>
          <button className="ab-btn" onClick={cancel} disabled={status !== "running"}>
            Cancel
          </button>
        </div>
      </div>

      <div className="ab-testchat__messages" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="ab-help">
            {canRun
              ? "Send a prompt to stream responses from the orchestration engine."
              : "Build a graph on the canvas to enable testing."}
          </div>
        )}
        {messages.map((message) => (
          <TestChatMessage key={message.id} m={message} />
        ))}
      </div>

      <div className="ab-testchat__composer">
        <textarea
          ref={editorRef}
          rows={3}
          placeholder={status === "paused" ? "Run paused by engine." : "Type a prompt and press Send."}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              handleSend();
            }
          }}
          disabled={status === "running" || !canRun}
        />
        <button className="ab-btn ab-btn--primary" onClick={handleSend} disabled={!canSend}>
          {status === "running" ? "Streaming..." : "Send"}
        </button>
      </div>

      {usage && (
        <div className="ab-testchat__usage">
          <strong>Usage</strong>
          <pre>{JSON.stringify(usage, null, 2)}</pre>
        </div>
      )}

      {error && <div className="ab-testchat__error">Error: {error}</div>}
    </div>
  );
}
