import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { setOrchestratorBase } from "../../../lib/orch/client";
import type { ResumePayload } from "../../../lib/orch/types";
import { useResponsesStream } from "../hooks/useResponsesStream";
import ResumeBar from "./ResumeBar";
import TestChatMessage from "./TestChatMessage";
import TelemetryDrawer from "./TelemetryDrawer";

type TestChatPaneProps = {
  ir: unknown;
  tenantId: string;
  authToken?: string;
  baseUrl: string;
  autoFocus?: boolean;
  canRun: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

type InnerProps = TestChatPaneProps & {
  onReset: () => void;
};

type TelemetryLevel = "none" | "basic" | "verbose";

const buildHeaders = (tenantId: string, authToken?: string, telemetryLevel: TelemetryLevel = "none"): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-Tenant-ID": tenantId,
    "X-Request-ID": crypto.randomUUID(),
    "X-Correlation-ID": crypto.randomUUID(),
    "X-Telemetry": telemetryLevel,
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

function TestChatPaneInner({
  ir,
  tenantId,
  authToken,
  baseUrl,
  autoFocus,
  canRun,
  isFullscreen,
  onToggleFullscreen,
  onReset,
}: InnerProps) {
  const [input, setInput] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [telemetryLevel, setTelemetryLevel] = useState<TelemetryLevel>("none");
  const [activeTab, setActiveTab] = useState<"chat" | "telemetry">("chat");
  const telemetryId = useId();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { runId, messages, status, usage, error, hitl, telemetry, send, resume, cancel } = useResponsesStream();

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
    const trimmed = input.trim();
    if (!canRun || !trimmed) {
      return;
    }
    send(ir, trimmed, buildHeaders(tenantId, authToken, telemetryLevel));
    setInput("");
  }, [authToken, canRun, input, ir, send, tenantId, telemetryLevel]);

  const handleResume = useCallback(
    async (payload: ResumePayload) => {
      setResumeBusy(true);
      try {
        await resume(payload, buildHeaders(tenantId, authToken, telemetryLevel));
      } finally {
        setResumeBusy(false);
      }
    },
    [resume, tenantId, authToken, telemetryLevel],
  );

  const canSend = input.trim().length > 0 && status !== "running" && canRun;

  const statusLabel = useMemo(() => {
    switch (status) {
      case "running":
        return "Running";
      case "paused":
        return hitl ? "Paused - choose an option below to continue" : "Paused";
      case "done":
        return "Completed";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  }, [status, hitl]);

  const telemetryEnabled = telemetryLevel !== "none";

  return (
    <div className="ab-testchat">
      <div className="ab-testchat__header">
        <div className="ab-testchat__head">
          <div className="ab-testchat__head-top">
            <div className="ab-testchat__title-block">
              <div className="ab-testchat__title">Test Chat</div>
              <div className="ab-testchat__status" aria-live="polite">
                <span>{statusLabel}</span>
                {runId && <span className="ab-testchat__run">Run: {runId}</span>}
              </div>
            </div>
            <div className="ab-testchat__action-bar">
              {onToggleFullscreen ? (
                <button
                  type="button"
                  className="ab-testchat__icon-btn"
                  onClick={onToggleFullscreen}
                  aria-pressed={Boolean(isFullscreen)}
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <svg className="ab-testchat__icon" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4.5 4.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="ab-testchat__icon" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3 6V3h3M10 3h3v3M3 10v3h3M13 10v3h-3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  )}
                  <span className="ab-testchat__sr-only">{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</span>
                </button>
              ) : null}
              <button
                className="ab-testchat__icon-btn ab-testchat__icon-btn--ghost"
                onClick={onReset}
                disabled={status === "running" || messages.length === 0}
                title="Clear conversation"
              >
                <svg className="ab-testchat__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3.5 8h8.5M6.5 5.5L3.5 8l3 2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <span className="ab-testchat__sr-only">Clear conversation</span>
              </button>
              <button
                className="ab-testchat__icon-btn ab-testchat__icon-btn--danger"
                onClick={cancel}
                disabled={status !== "running" && status !== "paused"}
                title="Cancel run"
              >
                <svg className="ab-testchat__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <rect
                    x="5"
                    y="5"
                    width="6"
                    height="6"
                    rx="1.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                <span className="ab-testchat__sr-only">Cancel run</span>
              </button>
            </div>
          </div>
        </div>
        <div className="ab-testchat__tabs-row">
          <div className="ab-tabs ab-testchat__tabs" role="tablist" aria-label="Test chat views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "chat"}
              className={`ab-tab ${activeTab === "chat" ? "ab-tab--active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Conversation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "telemetry"}
              className={`ab-tab ${activeTab === "telemetry" ? "ab-tab--active" : ""}`}
              onClick={() => setActiveTab("telemetry")}
            >
              Telemetry
            </button>
          </div>
          <div className="ab-testchat__tabs-telemetry">
            <label className="ab-testchat__telemetry" htmlFor={telemetryId}>
              <span className="ab-testchat__telemetry-label">Telemetry</span>
              <select
                id={telemetryId}
                className="ab-testchat__select"
                value={telemetryLevel}
                onChange={(e) => setTelemetryLevel(e.target.value as TelemetryLevel)}
              >
                <option value="none">none</option>
                <option value="basic">basic</option>
                <option value="verbose">verbose</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className={`ab-testchat__body ab-testchat__body--${activeTab}`}>
        {activeTab === "chat" ? (
          <div className="ab-testchat__column">
            <div className="ab-testchat__messages" ref={scrollRef} aria-live="polite">
              {messages.length === 0 && (
                <div className="ab-testchat__empty">
                  {canRun
                    ? "Send a prompt to stream responses from the orchestration engine."
                    : "Build a graph on the canvas to enable testing."}
                </div>
              )}
              {messages.map((message) => (
                <TestChatMessage key={message.id} m={message} />
              ))}
            </div>

            {status === "paused" && hitl && <ResumeBar hitl={hitl} onResume={handleResume} busy={resumeBusy} />}

            <div className="ab-testchat__composer">
              <textarea
                ref={editorRef}
                rows={3}
                placeholder={status === "paused" ? "Run paused by engine." : "Type a prompt and press Send."}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
                disabled={status === "running" || !canRun}
                className="ab-testchat__input"
              />
              <div className="ab-testchat__composer-hint">Enter to send / Shift+Enter for newline</div>
              <button className="ab-testchat__button ab-testchat__send" onClick={handleSend} disabled={!canSend}>
                {status === "running" ? "Streaming..." : "Send"}
              </button>
            </div>

            {usage ? (
              <div className="ab-testchat__usage">
                <strong>Usage</strong>
                <pre>{JSON.stringify(usage, null, 2)}</pre>
              </div>
            ) : null}

            {error && <div className="ab-testchat__error">Error: {error}</div>}
          </div>
        ) : (
          <div className="ab-testchat__telemetry">
            <TelemetryDrawer rows={telemetry} enabled={telemetryEnabled} />
            {!telemetryEnabled && telemetry.length > 0 && (
              <div className="ab-testchat__hint">Telemetry collection is paused. Switch to basic or verbose to keep streaming.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
