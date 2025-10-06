import { Handle, NodeProps, Position } from "reactflow";
import { useAgentBuilder } from "../../store/AgentBuilderContext";
import { useValidation } from "../../hooks/useValidation";

type Data = { label?: string };

export default function RouterNode({ id, data }: NodeProps<Data>) {
  const { state } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${id}`));
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = !hasError && issues.some((i) => i.severity === "warning");

  const router = state.ir.nodes.find((n) => n.id === id && n.kind === "router") as any;
  const minConf = router?.data?.minConfidence ?? 0.5;
  const targets = (router?.data?.targets as string[] | undefined) ?? [];

  return (
    <div className={`ab-node ab-node--router`} data-node-id={id}>
      <div className="ab-node__header">
        <div className="ab-node__head-left">
          <span className="ab-node__title">{data?.label || "Router"}</span>
          <span className="ab-node__subtitle">Router (Handoff)</span>
        </div>
        <span className={`ab-status ${hasError ? "ab-status--error" : hasWarning ? "ab-status--warn" : "ab-status--ok"}`} />
      </div>
      <div className="ab-node__meta">
        <span className="ab-chip">minConf={minConf}</span>
        <span className="ab-chip">targets: {targets.join(", ") || "—"}</span>
      </div>
      <Handle type="target" position={Position.Top} className="ab-handle ab-handle--in" />
      <Handle type="source" position={Position.Bottom} className="ab-handle ab-handle--out" />
    </div>
  );
}
