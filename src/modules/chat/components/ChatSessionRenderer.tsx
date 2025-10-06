import { useEffect, useMemo } from "react";
import { useChatSession } from "../hooks/useChatSession";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";

const statusLabels: Record<string, string> = {
  idle: "Idle",
  busy: "Connecting.",
  error: "Error",
};

const sentInitialSessions = new Set<string>();

type ChatSessionRendererProps = {
  tenantId: string;
  sessionId: string;
  initialMessage?: {
    text: string;
    agentId?: string;
  };
};

export function ChatSessionRenderer({ tenantId, sessionId, initialMessage }: ChatSessionRendererProps) {
  const { turns, status, send, cancel, loadMore, hasMore, connected } = useChatSession(tenantId, sessionId);

  useEffect(() => {
    if (!initialMessage?.text?.trim()) {
      return;
    }
    if (sentInitialSessions.has(sessionId)) {
      return;
    }
    sentInitialSessions.add(sessionId);
    void send(initialMessage.text, initialMessage.agentId);
  }, [initialMessage, send, sessionId]);

  const showLive = status === "busy" && connected;
  const statusLabel = useMemo(() => {
    if (showLive) return "Live";
    return statusLabels[status] ?? "Idle";
  }, [showLive, status]);

  return (
    <section className="chat-shell" aria-live="polite">
      <div className="chat-shell__inner">
        <header className="chat-header">
          <div className="chat-header__status">
            <span className={`status-indicator${showLive ? " status-indicator--online" : ""}`} aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
          {showLive && (
            <button type="button" className="chat-header__action" onClick={cancel}>
              Cancel
            </button>
          )}
        </header>

        <Transcript
          turns={turns}
          onLoadMore={hasMore ? loadMore : undefined}
          footer={<Composer onSend={send} disabled={status === "busy" && connected} />}
        />
      </div>
    </section>
  );
}
