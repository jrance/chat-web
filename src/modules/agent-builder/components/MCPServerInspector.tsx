import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useValidation } from "../hooks/useValidation";
import { useState } from "react";
import AutoTextarea from "./AutoTextarea";
import { KNOWN_PROTOCOLS, KNOWN_AUTH } from "../../../lib/mcp/registry";
import { upsertMcpServer, removeMcpServer } from "../../../lib/mcp/ir";

export default function MCPServerInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "mcpServer") as any;
  if (!node) return null;
  const { computeIssues } = useValidation();
  const [tab, setTab] = useState<"Basics" | "Connection" | "Capabilities" | "Validation">("Basics");
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  const handleDelete = () => {
    const updatedIr = removeMcpServer(state.ir as any, nodeId);
    dispatch({ type: "SET_GRAPH", ir: updatedIr as any });
  };

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="MCP inspector tabs">
        {(["Basics", "Connection", "Capabilities", "Validation"] as const).map((t) => (
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
          <AutoTextarea value={node.description || ""} onChange={(val) => dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes: state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n)) } })} minRows={3} />
          <div className="ab-help">Optional; helps collaborators understand the MCP server.</div>
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button className="ab-btn ab-btn--danger" onClick={handleDelete}>Delete Server</button>
        </div>
      </div>
      )}

      {tab === "Connection" && (
      <div className="ab-inspector__section">
        <h3>Connection</h3>
        <label className="ab-field ab-field--stack">
          <span>URL</span>
          <input value={node.data.url || ""} onChange={(e) => update({ url: e.target.value })} placeholder="https://" />
          <div className="ab-help">MCP server endpoint URL.</div>
        </label>
        <label className="ab-field ab-field--stack">
          <span>Protocol</span>
          <select value={node.data.protocol || "mcp/1.0"} onChange={(e) => update({ protocol: e.target.value })}>
            {KNOWN_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="ab-help">MCP protocol version.</div>
        </label>
        <label className="ab-field ab-field--stack">
          <span>Auth Type</span>
          <select value={node.data.auth?.type || "client_credentials"} onChange={(e) => update({ auth: { ...(node.data.auth || {}), type: e.target.value } })}>
            {KNOWN_AUTH.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="ab-help">Authentication method for the MCP server.</div>
        </label>
        <label className="ab-field ab-field--stack">
          <span>Secret Ref</span>
          <input value={node.data.auth?.secretRef || ""} onChange={(e) => update({ auth: { ...(node.data.auth || {}), secretRef: e.target.value || null } })} placeholder="secrets/onedrive-cc" />
          <div className="ab-help">Reference to secret (e.g., secrets/onedrive-cc). Never store actual credentials.</div>
        </label>
        <label className="ab-field ab-field--stack">
          <span>Scopes (comma-separated)</span>
          <input value={(node.data.auth?.scopes || []).join(", ")} onChange={(e) => update({ auth: { ...(node.data.auth || {}), scopes: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) } })} placeholder="Files.Read, Files.Write" />
          <div className="ab-help">OAuth scopes required for this server.</div>
        </label>
      </div>
      )}

      {tab === "Capabilities" && (
      <div className="ab-inspector__section">
        <h3>Capabilities</h3>
        <div className="ab-help" style={{ marginBottom: "1rem" }}>Enable the capabilities this MCP server supports.</div>
        <div className="ab-cap-list">
          <label className="ab-field ab-field--check"><span>Tools</span><input type="checkbox" checked={Boolean(node.data.capabilities?.tools)} onChange={(e) => update({ capabilities: { ...(node.data.capabilities || {}), tools: e.target.checked } })} /></label>
          <label className="ab-field ab-field--check"><span>Resources</span><input type="checkbox" checked={Boolean(node.data.capabilities?.resources)} onChange={(e) => update({ capabilities: { ...(node.data.capabilities || {}), resources: e.target.checked } })} /></label>
          <label className="ab-field ab-field--check"><span>Prompts</span><input type="checkbox" checked={Boolean(node.data.capabilities?.prompts)} onChange={(e) => update({ capabilities: { ...(node.data.capabilities || {}), prompts: e.target.checked } })} /></label>
          <label className="ab-field ab-field--check"><span>Sampling</span><input type="checkbox" checked={Boolean(node.data.capabilities?.sampling)} onChange={(e) => update({ capabilities: { ...(node.data.capabilities || {}), sampling: e.target.checked } })} /></label>
        </div>
        <label className="ab-field ab-field--stack" style={{ marginTop: "1rem" }}>
          <span>Namespace Filter (comma-separated)</span>
          <input value={(node.data.namespaceFilter || []).join(", ")} onChange={(e) => update({ namespaceFilter: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} placeholder="Documents, Shared" />
          <div className="ab-help">Limit server scope to specific namespaces (e.g., "Documents", "Shared").</div>
        </label>
      </div>
      )}

      {tab === "Validation" && (
        <div className="ab-inspector__section">
          <h3>Validation</h3>
          <ul>
            {issues.map((i, idx) => (
              <li key={idx}>{i.severity === "warning" ? "⚠️" : "⛔"} {i.message}</li>
            ))}
            {issues.length === 0 && <li>✓ No issues</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
