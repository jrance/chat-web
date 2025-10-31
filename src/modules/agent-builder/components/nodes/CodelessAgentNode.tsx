import { Handle, NodeProps, Position } from "reactflow";
import { useAgentBuilder } from "../../store/AgentBuilderContext";
import { useValidation } from "../../hooks/useValidation";

type Data = { label?: string };

export default function CodelessAgentNode({ id, data }: NodeProps<Data>) {
  const { state } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${id}`));
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = !hasError && issues.some((i) => i.severity === "warning");

  const node = state.ir.nodes.find((n) => n.id === id && n.kind === "agent.codeless") as any;
  const provider = node?.data?.model?.provider;
  const modelId = node?.data?.model?.modelId;
  const temperature = node?.data?.model?.temperature;
  const attachedCount = (node?.data?.tools?.attached as string[] | undefined)?.length || 0;
  const toolsCount = attachedCount;

  return (
    <div className={`ab-node ab-node--agent-codeless`} data-node-id={id}>
      <div className="ab-node__header">
        <div className="ab-node__head-left">
          <span className="ab-node__title">{data?.label || "Codeless"}</span>
          <span className="ab-node__subtitle">Agent (Codeless)</span>
        </div>
        <span className={`ab-status ${hasError ? "ab-status--error" : hasWarning ? "ab-status--warn" : "ab-status--ok"}`} />
      </div>
      <div className="ab-node__meta">
        {(provider || modelId) && (
          <span className="ab-chip">model={provider}:{modelId}</span>
        )}
        {temperature != null && <span className="ab-chip">temp={temperature}</span>}
        {toolsCount > 0 && <span className="ab-chip">tools:{toolsCount}</span>}
      </div>
      <Handle type="target" position={Position.Top} className="ab-handle ab-handle--in" />
      <Handle type="source" position={Position.Bottom} className="ab-handle ab-handle--out" />
    </div>
  );
}
