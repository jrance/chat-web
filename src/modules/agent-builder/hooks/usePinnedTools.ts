import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "../types/tools";
import { useAgentStudio } from "../providers/AgentStudioProvider";

export function usePinnedTools(): { items: ToolDefinition[]; isLoading: boolean; error?: string } {
  const { toolsClient } = useAgentStudio();
  const [items, setItems] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!toolsClient.listPinnedTools) return;
    setLoading(true);
    toolsClient
      .listPinnedTools()
      .then((res) => {
        if (!active) return;
        setItems(res);
        setError(undefined);
      })
      .catch((e) => active && setError(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toolsClient]);

  return useMemo(() => ({ items, isLoading: loading, error }), [items, loading, error]);
}

