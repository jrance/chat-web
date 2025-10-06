import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ToolsClient, ToolDefinition } from "../types/tools";

export type FeatureFlags = {
  showPinnedTools?: boolean;
};

type AgentStudioContextValue = {
  tenantId: string;
  toolsClient: ToolsClient;
  featureFlags?: FeatureFlags;
  toolsIndex: Record<string, ToolDefinition>;
};

const AgentStudioContext = createContext<AgentStudioContextValue | undefined>(undefined);

export function AgentStudioProvider({ tenantId, toolsClient, featureFlags, children }: { tenantId: string; toolsClient: ToolsClient; featureFlags?: FeatureFlags; children: React.ReactNode }) {
  const [toolsIndex, setToolsIndex] = useState<Record<string, ToolDefinition>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        console.log("[AgentStudio] bootstrap tools index", { tenantId });
        const res = await toolsClient.listTools({ limit: 1000 });
        if (!active) return;
        const idx: Record<string, ToolDefinition> = {};
        for (const t of res.items) idx[t.id] = t;
        setToolsIndex(idx);
      } catch (e) {
        console.warn("[AgentStudio] failed to load tools index", e);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenantId, toolsClient]);

  const value = useMemo<AgentStudioContextValue>(() => ({ tenantId, toolsClient, featureFlags, toolsIndex }), [tenantId, toolsClient, featureFlags, toolsIndex]);
  return <AgentStudioContext.Provider value={value}>{children}</AgentStudioContext.Provider>;
}

export function useAgentStudio(): AgentStudioContextValue {
  const ctx = useContext(AgentStudioContext);
  if (!ctx) throw new Error("useAgentStudio must be used within AgentStudioProvider");
  return ctx;
}

