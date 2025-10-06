import { lazy, Suspense, useMemo } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { Node } from "reactflow";
import RouterInspector from "./RouterInspector";
import CodelessInspector from "./CodelessInspector";
import MCPServerInspector from "./MCPServerInspector";
import BYOEInspector from "./BYOEInspector";
import ToolInspector from "./ToolInspector";
import ConcurrentInspector from "./ConcurrentInspector";
import SequentialInspector from "./SequentialInspector";

const RJSFForm = lazy(() => import("./RJSFForm"));

export function Inspector(): JSX.Element {
  const { state, dispatch } = useAgentBuilder();
  const selected: Node | undefined = useMemo(() => state.nodes.find((n) => n.id === state.selectedNodeId), [state.nodes, state.selectedNodeId]);

  if (!selected) {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <div className="ab-inspector__placeholder">Select a node to edit.</div>
      </aside>
    );
  }

  const kind = selected.type as string;
  if (kind === "router") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <RouterInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "agent.codeless") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <CodelessInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "mcpServer") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <MCPServerInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "tool") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <ToolInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "concurrent") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <ConcurrentInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "sequential") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <SequentialInspector nodeId={selected.id} />
      </aside>
    );
  }
  if (kind === "agent.byoe") {
    return (
      <aside className="ab-inspector" aria-label="Inspector">
        <BYOEInspector nodeId={selected.id} />
      </aside>
    );
  }
  const isCodeless = kind === "agent.codeless";
  const isA2A = kind === "agent.remote";
  const isBYOE = kind === "agent.byoe";

  return (
    <aside className="ab-inspector" aria-label="Inspector">
      <div className="ab-inspector__section">
        <h3>Basics</h3>
        <label className="ab-field">
          <span>Name</span>
          <input
            value={(selected.data as any)?.label ?? ""}
            onChange={(e) => {
              const nodes = state.nodes.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, label: e.target.value } } : n));
              dispatch({ type: "SET_FLOW", nodes, edges: state.edges });
            }}
          />
        </label>
        <p className="ab-inspector__hint">Labels should be unique among siblings under the same orchestration parent.</p>
      </div>

      {isCodeless && (
        <div className="ab-inspector__section">
          <h3>Model / LLM</h3>
          <Suspense fallback={<div>Loading form…</div>}>
            <RJSFForm nodeId={selected.id} schemaKind="codeless" />
          </Suspense>
        </div>
      )}

      {isA2A && (
        <div className="ab-inspector__section">
          <h3>Remote (A2A)</h3>
          <Suspense fallback={<div>Loading form…</div>}>
            <RJSFForm nodeId={selected.id} schemaKind="a2a" />
          </Suspense>
        </div>
      )}

      {isBYOE && null}
    </aside>
  );
}
