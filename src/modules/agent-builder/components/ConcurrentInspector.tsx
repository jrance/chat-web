import { useMemo, useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useValidation } from "../hooks/useValidation";
import AutoTextarea from "./AutoTextarea";
import { listChildren } from "../utils/graph";

export default function ConcurrentInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "concurrent") as any;
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

  const setWeight = (id: string, v: string) => {
    const co = { ...(node.data.childOverrides || {}) } as any;
    const cur = co[id] || {};
    const val = v === "" ? 1.0 : Number(v);
    co[id] = { ...cur, weight: val };
    update({ childOverrides: co });
  };

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="Concurrent inspector tabs">
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
            <div className="ab-help">Optional; help collaborators understand this fan-out.</div>
          </label>
        </div>
      )}

      {tab === "Behavior" && (
        <div className="ab-inspector__section">
          <h3>Fan-out</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label className="ab-field ab-field--stack"><span>Timeout (s)</span>
              <input type="number" min={1} value={node.data.timeoutSec ?? 25} onChange={(e) => update({ timeoutSec: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="ab-field ab-field--stack"><span>Max Parallelism</span>
              <input type="number" min={1} value={(node.data.maxParallelism ?? orderedChildren.length) || 1} onChange={(e) => update({ maxParallelism: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="ab-field ab-field--stack"><span>On Child Error</span>
              <select value={node.data.onChildError || "SkipAndContinue"} onChange={(e) => update({ onChildError: e.target.value })}>
                <option>SkipAndContinue</option>
                <option>FailFast</option>
                <option>CollectPartial</option>
              </select>
              <div className="ab-help">Policy applies per child.</div>
            </label>
          </div>

          <h4>Children</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
            {orderedChildren.map((c: any, idx: number) => {
              const ov = (node.data.childOverrides || {})[c.id] || {};
              const enabled = ov.enabled ?? true;
              const weight = ov.weight ?? 1.0;
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "0.4rem" }}>
                    <label className="ab-field ab-field--check"><span>Enabled</span>
                      <input type="checkbox" checked={enabled} onChange={() => toggleEnabled(c.id)} />
                    </label>
                    <label className="ab-field ab-field--stack"><span>Weight</span>
                      <input type="number" step={0.1} value={weight} onChange={(e) => setWeight(c.id, e.target.value)} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>

          <h3 style={{ marginTop: "0.75rem" }}>Merge</h3>
          <label className="ab-field ab-field--stack"><span>Strategy</span>
            <select value={node.data.merge?.strategy || "Synthesize"} onChange={(e) => update({ merge: { ...(node.data.merge || {}), strategy: e.target.value } })}>
              <option>Synthesize</option>
              <option>HighestScore</option>
              <option>FirstBest</option>
            </select>
          </label>
          {node.data.merge?.strategy === "Synthesize" && (
            <label className="ab-field ab-field--stack"><span>Synth Prompt</span>
              <AutoTextarea value={node.data.merge?.synthPrompt || ""} onChange={(val) => update({ merge: { ...(node.data.merge || {}), synthPrompt: val } })} minRows={3} />
            </label>
          )}
          {node.data.merge?.strategy === "HighestScore" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
              <label className="ab-field ab-field--stack"><span>Score Field</span>
                <input value={node.data.merge?.scoreField || "confidence"} onChange={(e) => update({ merge: { ...(node.data.merge || {}), scoreField: e.target.value } })} />
              </label>
              <label className="ab-field ab-field--stack"><span>Min Score</span>
                <input type="number" step={0.01} value={node.data.merge?.minScore ?? ""} onChange={(e) => update({ merge: { ...(node.data.merge || {}), minScore: e.target.value === "" ? undefined : Number(e.target.value) } })} />
              </label>
            </div>
          )}
          {node.data.merge?.strategy === "FirstBest" && (
            <label className="ab-field ab-field--stack"><span>Acceptance Rule</span>
              <input value={node.data.merge?.acceptRule || "confidence>=0.8"} onChange={(e) => update({ merge: { ...(node.data.merge || {}), acceptRule: e.target.value } })} />
            </label>
          )}
          <label className="ab-field ab-field--check"><span>Include Child Traces</span>
            <input type="checkbox" checked={node.data.includeChildTraces ?? true} onChange={(e) => update({ includeChildTraces: e.target.checked })} />
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
