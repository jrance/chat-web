import { useCallback, useState } from "react";
import type { IRGraph } from "../model/ir";
import { compileGraph } from "../data/orchestratorApi";
import type { CompileResponse } from "../config/orchestratorConfig";

export function useCompile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompileResponse | null>(null);

  const runCompile = useCallback(async (ir: IRGraph) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await compileGraph(ir);
      setResult(resp);
      return resp;
    } catch (e: any) {
      setError(e?.message ?? "Compile failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { runCompile, loading, error, result };
}

