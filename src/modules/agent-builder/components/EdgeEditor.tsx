import { useMemo } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";

export function EdgeEditor(): JSX.Element | null {
  const { state, dispatch } = useAgentBuilder();
  const selected = useMemo(() => state.edges.find((e) => e.id === state.selectedEdgeId), [state.edges, state.selectedEdgeId]);
  if (!selected) return null;

  return (
    <aside className="ab-edge-editor" aria-label="Edge Editor">
      <h3>Edge</h3>
      <div className="ab-field">
        <span>ID</span>
        <code>{selected.id}</code>
      </div>
      <label className="ab-field">
        <span>Label</span>
        <input
          value={selected.label ?? ""}
          placeholder="e.g., target == Policy"
          onChange={(e) => dispatch({ type: "UPDATE_EDGE_LABEL", id: selected.id, label: e.target.value })}
        />
      </label>
    </aside>
  );
}

