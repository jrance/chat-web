import { Handle, NodeProps, Position } from "reactflow";
import { useAgentBuilder } from "../../store/AgentBuilderContext";
import { useValidation } from "../../hooks/useValidation";

type Data = { label?: string };

export default function GenericNode({ id, type, data }: NodeProps<Data>) {
  const { state } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const t = String(type ?? "node");
  const variant = t.replace(/\./g, "-");
  const title = data?.label || variant;
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${id}`));
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = !hasError && issues.some((i) => i.severity === "warning");

  return (
    <div className={`ab-node ab-node--${variant}`} data-node-id={id}>
      <div className="ab-node__header">
        <div className="ab-node__head-left">
          <span className="ab-node__title">{title}</span>
          <span className="ab-node__subtitle">{prettyKind(t)}</span>
        </div>
        <span className={`ab-status ${hasError ? "ab-status--error" : hasWarning ? "ab-status--warn" : "ab-status--ok"}`} />
      </div>
      <Handle type="target" position={Position.Top} className="ab-handle ab-handle--in" />
      <Handle type="source" position={Position.Bottom} className="ab-handle ab-handle--out" />
    </div>
  );
}

function prettyKind(kind: string) {
  switch (kind) {
    case "router":
      return "Router";
    case "sequential":
      return "Sequential";
    case "concurrent":
      return "Concurrent";
    case "groupchat":
      return "GroupChat";
    case "output":
      return "Output";
    case "agent.codeless":
      return "Codeless Agent";
    case "agent.byoe":
      return "BYOE Agent";
    case "agent.remote":
      return "Remote Agent";
    case "tool":
      return "Tool";
    case "mcpServer":
      return "MCP Server";
    default:
      return kind;
  }
}
