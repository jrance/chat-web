import { useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useValidation } from "../hooks/useValidation";
import AutoTextarea from "./AutoTextarea";

export default function BYOEInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "agent.byoe") as any;
  const [tab, setTab] = useState<"Basics" | "Config" | "Validation">("Basics");
  if (!node) return null;

  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="BYOE agent inspector tabs">
        {(["Basics", "Config", "Validation"] as const).map((t) => (
          <button key={t} className={`ab-tab ${tab === t ? "ab-tab--active" : ""}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Basics" && (
        <div className="ab-inspector__section">
          <h3>Basics</h3>
          <label className="ab-field ab-field--stack">
            <span>Label</span>
            <input value={node.label} onChange={(e) => dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label: e.target.value })} />
            <div className="ab-help">Name shown on canvas and used in routes.</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Description</span>
            <AutoTextarea value={node.description || ""} onChange={(val) => {
              const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n));
              dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
            }} minRows={3} />
            <div className="ab-help">Optional; helps collaborators understand the agent.</div>
          </label>
        </div>
      )}

      {tab === "Config" && (
        <div className="ab-inspector__section">
          <h3>Runtime Configuration</h3>
          <label className="ab-field ab-field--stack"><span>Contract Version</span>
            <input value={node.data.contractVersion || ""} onChange={(e) => update({ contractVersion: e.target.value })} />
          </label>

          <h4>Routing</h4>
          <label className="ab-field ab-field--stack"><span>Selector</span>
            <select value={node.data.routing?.selector || "topic"} onChange={(e) => update({ routing: { ...(node.data.routing || {}), selector: e.target.value } })}>
              <option value="topic">topic</option>
              <option value="header">header</option>
            </select>
          </label>
          {node.data.routing?.selector === "topic" && (
            <label className="ab-field ab-field--stack"><span>Commands Topic</span>
              <input value={node.data.routing?.commandsTopic || ""} onChange={(e) => update({ routing: { ...(node.data.routing || {}), commandsTopic: e.target.value } })} />
            </label>
          )}
          {node.data.routing?.selector === "header" && (
            <>
              <label className="ab-field ab-field--stack"><span>Header Key</span>
                <input value={node.data.routing?.headerKey || ""} onChange={(e) => update({ routing: { ...(node.data.routing || {}), headerKey: e.target.value } })} />
              </label>
              <label className="ab-field ab-field--stack"><span>Header Value</span>
                <input value={node.data.routing?.headerValue || ""} onChange={(e) => update({ routing: { ...(node.data.routing || {}), headerValue: e.target.value } })} />
              </label>
            </>
          )}

          <h4>Topics</h4>
          <div className="ab-duo">
            <div className="ab-duo__col">
              <div className="ab-duo__label">Events</div>
              <input value={node.data.topics?.events || ""} onChange={(e) => update({ topics: { ...(node.data.topics || {}), events: e.target.value } })} />
            </div>
            <div className="ab-duo__col">
              <div className="ab-duo__label">Tokens</div>
              <input value={node.data.topics?.tokens || ""} onChange={(e) => update({ topics: { ...(node.data.topics || {}), tokens: e.target.value } })} />
            </div>
          </div>
          <div className="ab-duo">
            <div className="ab-duo__col">
              <div className="ab-duo__label">Tools (Req)</div>
              <input value={node.data.topics?.toolsReq || ""} onChange={(e) => update({ topics: { ...(node.data.topics || {}), toolsReq: e.target.value } })} />
            </div>
            <div className="ab-duo__col">
              <div className="ab-duo__label">Tools (Res)</div>
              <input value={node.data.topics?.toolsRes || ""} onChange={(e) => update({ topics: { ...(node.data.topics || {}), toolsRes: e.target.value } })} />
            </div>
          </div>
          <label className="ab-field ab-field--stack"><span>DLQ (optional)</span>
            <input value={node.data.topics?.dlq || ""} onChange={(e) => update({ topics: { ...(node.data.topics || {}), dlq: e.target.value } })} />
          </label>

          <label className="ab-field ab-field--stack"><span>Consumer Group</span>
            <input value={node.data.consumerGroup || ""} onChange={(e) => update({ consumerGroup: e.target.value })} />
          </label>

          <h4>Encryption</h4>
          <label className="ab-field ab-field--check"><span>Enabled</span>
            <input type="checkbox" checked={Boolean(node.data.encryption?.enabled)} onChange={(e) => update({ encryption: { ...(node.data.encryption || {}), enabled: e.target.checked } })} />
          </label>
          <label className="ab-field ab-field--stack"><span>JWK ID</span>
            <input value={node.data.encryption?.jwkId || ""} onChange={(e) => update({ encryption: { ...(node.data.encryption || {}), jwkId: e.target.value } })} />
          </label>

          <label className="ab-field ab-field--check"><span>Allow Tool Router</span>
            <input type="checkbox" checked={Boolean(node.data.allowToolRouter)} onChange={(e) => update({ allowToolRouter: e.target.checked })} />
          </label>
        </div>
      )}

      {tab === "Validation" && (
        <div className="ab-inspector__section">
          <h3>Validation</h3>
          <ul>
            {issues.map((i, idx) => (
              <li key={idx}>{i.severity === "warning" ? "??" : "?"} {i.message}</li>
            ))}
            {issues.length === 0 && <li>✓ No issues</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

