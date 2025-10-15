// Orchestrator API endpoints for Agent Builder
// Configure via Vite env: VITE_ORCH_API (e.g., http://127.0.0.1:8000)
// Falls back to local dev server if not provided.

const ORCH_API_BASE = (import.meta as any).env?.VITE_ORCH_API ?? "http://127.0.0.1:8000";

export const orchestratorApiBase = (): string => String(ORCH_API_BASE).replace(/\/$/, "");

export const compileUrl = (): string => `${orchestratorApiBase()}/compile`;

export const executeUrl = (): string => `${orchestratorApiBase()}/execute`;

export const executeStreamUrl = (): string => `${orchestratorApiBase()}/execute/stream`;

export type CompileResponse = {
  ok?: boolean;
  orchestration?: string;
  agents?: any[];
  tools?: any[];
  capabilities?: Record<string, unknown>;
  notes?: string[];
};

