import { useMemo, useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useValidation } from "../hooks/useValidation";
import AutoTextarea from "./AutoTextarea";
import { listChildren } from "../utils/graph";

export default function SequentialInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "sequential") as any;
  const [tab, setTab] = useState<"Basics" | "Behavior" | "Validation">("Basics");
  if (!node) return null;

  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  const childrenRaw = useMemo(() => listChildren(state.ir, nodeId), [state.ir, nodeId]);
  const order: string[] = (node.data.childrenOrder || []) as string[];
  const orderedChildren = useMemo(() => {
    const out: any[] = [];
    const byId: Record<string, any> = {};
    for (const c of childrenRaw) byId[c.id] = c;
    for (const id of order) if (byId[id]) out.push(byId[id]);
    for (const c of childrenRaw) if (!order.includes(c.id)) out.push(c);
    return out;
  }, [childrenRaw, order]);

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...(n as any).data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  const setOrder = (ids: string[]) => update({ childrenOrder: ids });
  const move = (id: string, dir: -1 | 1) => {
    const ids = orderedChildren.map((c: any) => c.id);
    const idx = ids.indexOf(id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    const [tmp] = next.splice(idx, 1);
    next.splice(j, 0, tmp);
    setOrder(next);
  };

  const toggleEnabled = (id: string) => {
    const co = { ...(node.data.childOverrides || {}) } as any;
    const cur = co[id] || {};
    co[id] = { ...cur, enabled: !(cur.enabled ?? true) };
    update({ childOverrides: co });
  };

  const setMinConf = (id: string, v: string) => {
    const co = { ...(node.data.childOverrides || {}) } as any;
    const cur = co[id] || {};
    const val = v === "" ? null : Math.max(0, Math.min(1, Number(v)));
    co[id] = { ...cur, minConfidence: v === "" ? null : val };
    update({ childOverrides: co });
  };

  const setStopAfter = (id: string, on: boolean) => {
    const co = { ...(node.data.childOverrides || {}) } as any;
    const cur = co[id] || {};
    co[id] = { ...cur, stopAfter: on };
    update({ childOverrides: co });
  };

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="Sequential inspector tabs">
        {(["Basics", "Behavior", "Validation"] as const).map((t) => (
          <button key={t} className={`ab-tab ${tab === t ? "ab-tab--active" : ""}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Basics" && (
        <div className="ab-inspector__section">
          <h3>Basics</h3>
          <label className="ab-field ab-field--stack"><span>Label</span>
            <input value={node.label} onChange={(e) => dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label: e.target.value })} />
            <div className="ab-help">Shown on canvas and used in routes.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Description</span>
            <AutoTextarea value={node.description || ""} onChange={(val) => {
              const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n));
              dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
            }} minRows={3} />
            <div className="ab-help">Optional; help collaborators understand this sequence.</div>
          </label>
        </div>
      )}

      {tab === "Behavior" && (
        <div className="ab-inspector__section">
          <h3>Behavior</h3>
          <label className="ab-field ab-field--stack"><span>Break On</span>
            <select value={node.data.breakOn || "Never"} onChange={(e) => update({ breakOn: e.target.value })}>
              <option>Never</option>
              <option>OnFirstAnswer</option>
              <option>HighConfidence</option>
            </select>
            <div className="ab-help">
              {node.data.breakOn === "Never"
                ? "Runs all enabled children in order."
                : node.data.breakOn === "OnFirstAnswer"
                ? "Stops when a child yields any non-empty answer."
                : "Stops when a child reaches its minConfidence threshold."}
            </div>
          </label>

          <h4>Child Order</h4>
          <div className="ab-hint">Drag-order semantics approximated with up/down controls.</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
            {orderedChildren.map((c: any, idx: number) => {
              const ov = (node.data.childOverrides || {})[c.id] || {};
              const enabled = ov.enabled ?? true;
              return (
                <li key={c.id} style={{ border: "1px solid #3f4149", borderRadius: 6, padding: "0.4rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.5rem", alignItems: "center" }}>
                    <span className="ab-chip" title="Position">{idx + 1}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <strong>{c.label}</strong>
                      <span className="ab-chip">{c.kind}</span>
                      {!enabled && <span className="ab-chip">disabled</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="ab-btn ab-btn--outline" onClick={() => move(c.id, -1)} disabled={idx === 0}>↑</button>
                      <button className="ab-btn ab-btn--outline" onClick={() => move(c.id, +1)} disabled={idx === orderedChildren.length - 1}>↓</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", marginTop: "0.4rem" }}>
                    <label className="ab-field ab-field--check"><span>Enabled</span>
                      <input type="checkbox" checked={enabled} onChange={() => toggleEnabled(c.id)} />
                    </label>
                    {node.data.breakOn === "Never" && (
                      <label className="ab-field ab-field--check"><span>Stop After</span>
                        <input type="checkbox" checked={Boolean(ov.stopAfter)} onChange={(e) => setStopAfter(c.id, e.target.checked)} />
                      </label>
                    )}
                  </div>
                  {node.data.breakOn === "HighConfidence" && (
                    <label className="ab-field" style={{ marginTop: "0.4rem", gridTemplateColumns: "auto 1fr" }}>
                      <span style={{ whiteSpace: "nowrap" }}>Min Confidence</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={ov.minConfidence ?? 0.8}
                        onChange={(e) => setMinConf(c.id, e.target.value)}
                        style={{ width: "6rem" }}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
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
