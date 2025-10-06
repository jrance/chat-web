import { Handle, NodeProps, Position } from "reactflow";
import { useAgentBuilder } from "../../store/AgentBuilderContext";
import { useTool } from "../../hooks/useTool";
import { useValidation } from "../../hooks/useValidation";

type Data = { label?: string };

export default function ToolNode({ id, data }: NodeProps<Data>) {
  const { state } = useAgentBuilder();
  const node = state.ir.nodes.find((n) => n.id === id && n.kind === "tool") as any;
  const toolId: string | undefined = node?.data?.toolId;
  const { tool } = useTool(toolId);
  const { computeIssues } = useValidation();
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${id}`));
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = !hasError && issues.some((i) => i.severity === "warning");

  const title = data?.label || node?.label || "Tool";
  const chipVersion = tool?.version || node?.data?.version;
  const chipName = tool?.name;
  const overridesCount = Object.keys((node?.data?.parameterOverrides as Record<string, any> | undefined) || {}).length;

  return (
    <div className={`ab-node ab-node--tool`} data-node-id={id}>
      <div className="ab-node__header">
        <div className="ab-node__head-left">
          <span className="ab-node__title">{title}</span>
          <span className="ab-node__subtitle">Tool</span>
        </div>
        <span className={`ab-status ${hasError ? "ab-status--error" : hasWarning ? "ab-status--warn" : "ab-status--ok"}`} />
      </div>
      <div className="ab-node__meta">
        {chipVersion && <span className="ab-chip">v{chipVersion}</span>}
        {chipName && <span className="ab-chip">{chipName}</span>}
        {overridesCount > 0 && <span className="ab-chip">overrides:{overridesCount}</span>}
      </div>
      <Handle type="target" position={Position.Top} className="ab-handle ab-handle--in" />
      <Handle type="source" position={Position.Bottom} className="ab-handle ab-handle--out" />
    </div>
  );
}
