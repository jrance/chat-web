import { useEffect, useMemo, useState } from "react";
import type { ToolsListQuery, ToolDefinition } from "../types/tools";
import { useAgentStudio } from "../providers/AgentStudioProvider";

export function useToolsCatalog(query?: ToolsListQuery): { items: ToolDefinition[]; nextCursor?: string; isLoading: boolean; error?: string } {
  const { tenantId, toolsClient } = useAgentStudio();
  const [items, setItems] = useState<ToolDefinition[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    console.log("[ToolsCatalog] query", { tenantId, query });
    toolsClient
      .listTools(query)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setError(undefined);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tenantId, toolsClient, JSON.stringify(query || {})]);

  return useMemo(() => ({ items, nextCursor, isLoading: loading, error }), [items, nextCursor, loading, error]);
}

