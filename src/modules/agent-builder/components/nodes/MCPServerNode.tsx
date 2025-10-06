import { Handle, NodeProps, Position } from "reactflow";
import { useAgentBuilder } from "../../store/AgentBuilderContext";
import { useValidation } from "../../hooks/useValidation";

type Data = { label?: string };

export default function MCPServerNode({ id, data }: NodeProps<Data>) {
  const { state } = useAgentBuilder();
  const node = state.ir.nodes.find((n) => n.id === id && n.kind === "mcpServer") as any;

  const title = data?.label || node?.label || "MCP Server";
  const url: string | undefined = node?.data?.url;
  const protocol: string | undefined = node?.data?.protocol;
  const capabilities = (node?.data?.capabilities || {}) as Record<string, boolean>;
  const selectedCaps = ["tools", "resources", "prompts", "sampling"].filter((k) => Boolean((capabilities as any)[k]));
  const { computeIssues } = useValidation();
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${id}`));
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = !hasError && issues.some((i) => i.severity === "warning");

  return (
    <div className={`ab-node ab-node--mcpServer`} data-node-id={id}>
      <div className="ab-node__header">
        <div className="ab-node__head-left">
          <span className="ab-node__title">{title}</span>
          <span className="ab-node__subtitle">MCP Server</span>
        </div>
        <span className={`ab-status ${hasError ? "ab-status--error" : hasWarning ? "ab-status--warn" : "ab-status--ok"}`} />
      </div>
      <div className="ab-node__meta">
        {url && <span className="ab-chip" title={url}>{truncate(url, 28)}</span>}
        {protocol && <span className="ab-chip">{protocol}</span>}
      </div>
      {selectedCaps.length > 0 && (
        <div className="ab-node__meta">
          <span className="ab-chip">capabilities={selectedCaps.join(", ")}</span>
        </div>
      )}
      <Handle type="target" position={Position.Top} className="ab-handle ab-handle--in" />
      <Handle type="source" position={Position.Bottom} className="ab-handle ab-handle--out" />
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (!s) return s;
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + "…";
}
