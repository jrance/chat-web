import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "../types/tools";
import { useAgentStudio } from "../providers/AgentStudioProvider";

export function useTool(toolId?: string): { tool?: ToolDefinition; isLoading: boolean; error?: string } {
  const { toolsClient, toolsIndex } = useAgentStudio();
  const [tool, setTool] = useState<ToolDefinition | undefined>(toolId ? toolsIndex[toolId] : undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!toolId) {
      setTool(undefined);
      return;
    }
    const cached = toolsIndex[toolId];
    if (cached) {
      setTool(cached);
      return;
    }
    setLoading(true);
    toolsClient
      .getTool(toolId)
      .then((t) => {
        if (!active) return;
        setTool(t);
        setError(undefined);
      })
      .catch((e) => active && setError(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toolId, toolsClient, toolsIndex]);

  return useMemo(() => ({ tool, isLoading: loading, error }), [tool, loading, error]);
}

