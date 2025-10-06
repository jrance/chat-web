import { useMemo, useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { listChildren } from "../utils/graph";
import { syncRouterEnum } from "../utils/routerEnumSync";
import { useValidation } from "../hooks/useValidation";
import AutoTextarea from "./AutoTextarea";

export default function RouterInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const router = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "router") as any;
  const [tab, setTab] = useState<"Basics" | "Behavior" | "Structured" | "Validation">("Basics");

  const children = useMemo(() => listChildren(state.ir, nodeId), [state.ir, nodeId]);
  const childLabels = children.map((c) => c.label);

  if (!router) return null;

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="Router inspector tabs">
        {(["Basics", "Behavior", "Structured", "Validation"] as const).map((t) => (
          <button
            key={t}
            className={`ab-tab ${tab === t ? "ab-tab--active" : ""}`}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Basics" && (
        <div className="ab-inspector__section">
          <h3>Basics</h3>
          <label className="ab-field ab-field--stack">
            <span>Label</span>
            <input
              value={router.label}
              onChange={(e) => dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label: e.target.value })}
            />
            <div className="ab-help">Must be unique among siblings under the same parent.</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Description</span>
            <AutoTextarea
              value={router.description || ""}
              onChange={(val) => {
                const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n));
                dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
              }}
              minRows={3}
            />
            <div className="ab-help">Optional note to clarify this router’s purpose.</div>
          </label>
        </div>
      )}

      {tab === "Behavior" && (
        <div className="ab-inspector__section">
          <h3>Behavior</h3>
          <label className="ab-field ab-field--stack">
            <span>Prompt</span>
            <AutoTextarea
              placeholder="Route to Policy, HR, M365, or Confluence. Return JSON {target, confidence}."
              value={router.data.prompt || ""}
              onChange={(val) => update({ prompt: val })}
              minRows={3}
            />
            <div className="ab-help">Explain routing targets and require JSON with target and confidence.</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Min Conf</span>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={router.data.minConfidence}
              onChange={(e) => update({ minConfidence: Number(e.target.value) })}
            />
            <div className="ab-help">Threshold for auto-accepting a route. 0–1 (e.g., 0.5).</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Tie-break</span>
            <select value={router.data.tieBreak} onChange={(e) => update({ tieBreak: e.target.value })}>
              <option value="HighestConfidence">HighestConfidence</option>
              <option value="DeterministicOrder">DeterministicOrder</option>
              <option value="PreferList">PreferList</option>
            </select>
            <div className="ab-help">Choose how to select when multiple options are close.</div>
          </label>
          {router.data.tieBreak === "PreferList" && (
            <label className="ab-field">
              <span>Prefer</span>
              <input
                placeholder="Comma-separated labels"
                value={(router.data.tieBreakPrefer || []).join(",")}
                onChange={(e) => update({ tieBreakPrefer: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
              />
              <div className="ab-help">Order labels by preference (must match current children).</div>
            </label>
          )}
          <label className="ab-field ab-field--stack">
            <span>Fallback</span>
            <select
              value={router.data.fallback?.mode || "AskUserClarify"}
              onChange={(e) => update({ fallback: { ...(router.data.fallback || {}), mode: e.target.value } })}
            >
              <option value="AskUserClarify">AskUserClarify</option>
              <option value="DefaultChild">DefaultChild</option>
              <option value="SafeAgent">SafeAgent</option>
              <option value="Error">Error</option>
            </select>
            <div className="ab-help">What to do when no confident route is found.</div>
          </label>
          {router.data.fallback?.mode === "DefaultChild" && (
            <label className="ab-field ab-field--stack">
              <span>Default</span>
              <select
                value={router.data.fallback?.defaultChild || ""}
                onChange={(e) => update({ fallback: { ...(router.data.fallback || {}), defaultChild: e.target.value } })}
              >
                <option value="">Select…</option>
                {childLabels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="ab-help">Child to use when Fallback is DefaultChild.</div>
            </label>
          )}
          <label className="ab-field">
            <span>Auto-sync</span>
            <input
              type="checkbox"
              checked={Boolean(router.data.autoSyncEnum)}
              onChange={(e) => update({ autoSyncEnum: e.target.checked })}
            />
            <div className="ab-help">Keep routeSchema target enum updated to child labels.</div>
          </label>
          <div className="ab-hint">Children: {childLabels.join(", ") || "—"}</div>
        </div>
      )}

      {tab === "Structured" && (
        <div className="ab-inspector__section ab-inspector__section--grow">
          <h3>Structured Output</h3>
          <div className="ab-hint">Targets (derived): {childLabels.join(", ") || "—"}</div>
          <div style={{ margin: "0.5rem 0" }}>
            <button
              className="ab-btn ab-btn--secondary"
              onClick={() => dispatch({ type: "SET_GRAPH", ir: syncRouterEnum(state.ir, nodeId) })}
            >
              Sync enum
            </button>
          </div>
          <div className="ab-json-editor">
            <div className="ab-json-editor__label">Route Schema (JSON)</div>
            <AutoTextarea
              className="ab-json-textarea"
              value={JSON.stringify(router.data.routeSchema || {}, null, 2)}
              onChange={(val) => {
                try {
                  const parsed = JSON.parse(val);
                  update({ routeSchema: parsed });
                } catch {
                  // allow editing invalid JSON temporarily
                }
              }}
              expandWithinParent
              minRows={8}
            />
            <div className="ab-help">Provide a JSON Schema with target enum and confidence (0–1).</div>
          </div>
          <div className="ab-hint">Required: target (string with enum), confidence (number 0..1).</div>
        </div>
      )}

      {tab === "Validation" && (
        <div className="ab-inspector__section">
          <h3>Validation</h3>
          <ul>
            {issues.map((i, idx) => (
              <li key={idx}>
                {i.severity === "warning" ? "⚠️" : "⛔"} {i.message}
              </li>
            ))}
            {issues.length === 0 && <li>✓ No issues</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
