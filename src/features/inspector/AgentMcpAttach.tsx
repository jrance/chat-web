import React from "react";
import { listMcpServers, setAgentAttachedServers, getAgentAttachedServers } from "../../lib/mcp/ir";
import type { IRGraph } from "../../modules/agent-builder/model/ir";

type Props = {
  graph: IRGraph;
  agentId: string;
  onGraphChange: (g: IRGraph) => void;
};

export default function AgentMcpAttach({ graph, agentId, onGraphChange }: Props) {
  const servers = listMcpServers(graph as any);
  const selected = new Set(getAgentAttachedServers(graph as any, agentId));

  const toggle = (sid: string) => {
    const next = new Set(selected);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    const updatedGraph = setAgentAttachedServers(graph as any, agentId, Array.from(next));
    onGraphChange(updatedGraph as any);
  };

  if (!servers.length) {
    return (
      <div className="ab-inspector__section">
        <div className="ab-inspector__placeholder">No MCP servers in this graph yet.</div>
        <div className="ab-help">Create an MCP server node from the palette to attach it to this agent.</div>
      </div>
    );
  }

  return (
    <div className="ab-inspector__section">
      <h3>Attach MCP Servers</h3>
      <div className="ab-help" style={{ marginBottom: "1rem" }}>
        Connect this agent to MCP servers to enable external capabilities.
      </div>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {servers.map((s) => (
          <label key={s.id} className="ab-field ab-field--check" style={{ 
            padding: "0.5rem", 
            border: "1px solid #3f4149", 
            borderRadius: "4px",
            cursor: "pointer"
          }}>
            <input 
              type="checkbox" 
              checked={selected.has(s.id)} 
              onChange={() => toggle(s.id)} 
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontWeight: 500 }}>{s.label}</span>
              <span className="ab-help" style={{ fontSize: "0.85em" }}>
                {s.data.protocol} • {s.data.url || "no URL"}
              </span>
            </div>
          </label>
        ))}
      </div>
      {selected.size > 0 && (
        <div className="ab-help" style={{ marginTop: "1rem" }}>
          ✓ {selected.size} server{selected.size > 1 ? 's' : ''} attached
        </div>
      )}
    </div>
  );
}
