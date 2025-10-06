import { USE_MOCK_CHAT, historyUrl, sendUrl, cancelUrl } from "../config/chatConfig";
import type { Paged, HistoryItem, SendMessagePayload } from "../model/types";
import { mockFetchHistory, mockSendMessage, mockCancelRun } from "../mocks/mockChat";

export async function fetchHistory(tenantId: string, sessionId: string, cursor?: string): Promise<Paged<HistoryItem>> {
  if (USE_MOCK_CHAT) {
    return mockFetchHistory(tenantId, sessionId, cursor);
  }
  const res = await fetch(historyUrl(tenantId, sessionId, cursor), { credentials: "include" });
  if (!res.ok) throw new Error(`history ${res.status}`);
  return res.json();
}

export async function sendMessage(tenantId: string, payload: SendMessagePayload): Promise<{ runId: string }> {
  if (USE_MOCK_CHAT) {
    return mockSendMessage(tenantId, payload);
  }
  const body = {
    messages: [{ author: "user", messageType: "content", content: payload.text }],
    ...(payload.agentId ? { agentId: payload.agentId } : {}),
    ...(payload.attachments && payload.attachments.length ? { attachments: payload.attachments } : {}),
  };

  const res = await fetch(sendUrl(tenantId, payload.sessionId), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`send ${res.status}`);
  return res.json(); // { runId }
}

export async function cancelRun(tenantId: string, runId: string): Promise<void> {
  if (USE_MOCK_CHAT) {
    await mockCancelRun(tenantId, runId);
    return;
  }
  const res = await fetch(cancelUrl(tenantId, runId), { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`cancel ${res.status}`);
}
