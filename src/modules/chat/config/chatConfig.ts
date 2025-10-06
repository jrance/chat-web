const CHAT_API_BASE = import.meta.env.VITE_CHAT_API ?? "/api";
export const DEFAULT_TENANT_ID = import.meta.env.VITE_CHAT_TENANT ?? "default";
export const USE_MOCK_CHAT = (import.meta.env.VITE_USE_MOCK_CHAT ?? "true").toLowerCase() === "true";
export const PAGE_SIZE = 50;
export const HEARTBEAT_MS = 20000;

export function streamUrl(tenantId: string, sessionId: string, runId: string) {
  return `${CHAT_API_BASE}/tenants/${tenantId}/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/stream`;
}

export function historyUrl(tenantId: string, sessionId: string, cursor?: string) {
  const base = `${CHAT_API_BASE}/tenants/${tenantId}/sessions/${encodeURIComponent(sessionId)}/messages`;
  return cursor ? `${base}?afterTurn=${cursor}&limit=${PAGE_SIZE}` : `${base}?limit=${PAGE_SIZE}`;
}

export function sendUrl(tenantId: string, sessionId: string) {
  return `${CHAT_API_BASE}/tenants/${tenantId}/sessions/${encodeURIComponent(sessionId)}/messages`;
}

export function cancelUrl(tenantId: string, runId: string) {
  return `${CHAT_API_BASE}/tenants/${tenantId}/runs/${encodeURIComponent(runId)}/cancel`;
}
