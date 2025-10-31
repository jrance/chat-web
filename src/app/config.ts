const env = import.meta.env ?? {};

export const API_BASE: string = typeof env.VITE_API_BASE === "string" && env.VITE_API_BASE
  ? String(env.VITE_API_BASE)
  : "http://localhost:8000";

export const DEFAULT_TENANT_ID: string = typeof env.VITE_TENANT_ID === "string" && env.VITE_TENANT_ID
  ? String(env.VITE_TENANT_ID)
  : "demo";

export const ORCH_AUTH_TOKEN: string | undefined =
  typeof env.VITE_ORCH_TOKEN === "string" && env.VITE_ORCH_TOKEN ? String(env.VITE_ORCH_TOKEN) : undefined;
