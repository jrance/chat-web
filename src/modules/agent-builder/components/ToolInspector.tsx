import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useToolsCatalog } from "../hooks/useToolsCatalog";
import { useTool } from "../hooks/useTool";
import AutoTextarea from "./AutoTextarea";
import { useValidation } from "../hooks/useValidation";
import { useState } from "react";

export default function ToolInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "tool") as any;
  if (!node) return null;
  const [tab, setTab] = useState<"Basics" | "Select" | "Parameters" | "Validation">("Basics");
  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  const selectTool = (toolId: string) => {
    const def = all.find((t) => t.id === toolId);
    const version = def?.version;
    // Update node label to tool display name, if present
    const label = def?.displayName || def?.name || node.label || "Tool";
    dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label });
    update({ toolId, version, parameterOverrides: {} });
  };
  const { tool: selected } = useTool(node.data.toolId);
  const { items: all } = useToolsCatalog();

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="Tool inspector tabs">
        {(["Basics", "Select", "Parameters", "Validation"] as const).map((t) => (
          <button key={t} className={`ab-tab ${tab === t ? "ab-tab--active" : ""}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Basics" && (<div className="ab-inspector__section">
        <h3>Basics</h3>
        <label className="ab-field ab-field--stack">
          <span>Label</span>
          <input value={node.label} onChange={(e) => dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label: e.target.value })} />
          <div className="ab-help">Name shown on canvas and used in routes.</div>
        </label>
        <label className="ab-field ab-field--stack">
          <span>Description</span>
          <AutoTextarea value={node.description || ""} onChange={(val) => dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes: state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n)) } })} minRows={3} />
          <div className="ab-help">Optional; helps collaborators understand the agent.</div>
        </label>
      </div>)}

      {tab === "Select" && (<div className="ab-inspector__section">
        <h3>Tool Selection</h3>
        <label className="ab-field ab-field--stack">
          <span>Tool</span>
          <select value={node.data.toolId || ""} onChange={(e) => selectTool(e.target.value)}>
            <option value="">Select a tool…</option>
            {all.map((t) => (
              <option key={t.id} value={t.id}>
                {(t.displayName || t.name)} (v{t.version})
              </option>
            ))}
          </select>
        </label>
        <div className="ab-hint">Version: {node.data.version || selected?.version || "-"}</div>
        {selected?.description && <div className="ab-hint">{selected.description}</div>}
        {selected?.metadata?.docsUrl && (
          <a href={selected.metadata.docsUrl} target="_blank" rel="noreferrer">
            Docs
          </a>
        )}
      </div>)}

      {tab === "Parameters" && selected && (
        <div className="ab-inspector__section">
          <h3>Parameters</h3>
          {selected.parameters && selected.parameters.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {selected.parameters.map((p: any) => {
                const isLocked = p.scope === "OrgLocked";
                const overrides = node.data.parameterOverrides || {};
                const val = Object.prototype.hasOwnProperty.call(overrides, p.name) ? overrides[p.name] : (p.default ?? "");
                const onChange = (v: any) => {
                  const next = { ...(node.data.parameterOverrides || {}) } as Record<string, any>;
                  if (v === "" || v === null || v === undefined || (p.type === "string" && v === "")) {
                    delete next[p.name];
                  } else {
                    next[p.name] = v;
                  }
                  update({ parameterOverrides: next });
                };
                return (
                  <div key={p.name} className="ab-field ab-field--stack">
                    <span>
                      {p.name}
                      <span className="ab-chip" style={{ marginLeft: 8 }}>
                        {p.type}{p.type === "enum" && p.enum ? `(${p.enum.join("|")})` : ""}
                      </span>
                      <span className="ab-chip" style={{ marginLeft: 6 }}>{p.scope}</span>
                    </span>
                    {isLocked ? (
                      <span className="ab-hint">Org-locked</span>
                    ) : p.type === "boolean" ? (
                      <input type="checkbox" checked={Boolean(val)} onChange={(e) => onChange(e.target.checked)} />
                    ) : p.type === "number" ? (
                      <input type="number" min={p.min ?? undefined} max={p.max ?? undefined} value={val}
                        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
                    ) : p.type === "enum" ? (
                      <select value={val} onChange={(e) => onChange(e.target.value)}>
                        {(p.enum || []).map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input value={val} onChange={(e) => onChange(e.target.value)} />
                    )}
                    <div className="ab-hint">
                      Default: {String(p.default ?? "")} {p.description ? `• ${p.description}` : ""}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.5rem" }}>
                <button className="ab-btn ab-btn--outline" onClick={() => update({ parameterOverrides: {} })}>Reset all overrides</button>
              </div>
            </div>
          ) : (
            <div className="ab-inspector__placeholder">No parameters for this tool.</div>
          )}
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
