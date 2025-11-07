import "../styles/canvas.css";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type { BasicType, GraphDoc, Id, NodeAny } from "../model/ir";
import {
  addNode,
  checkPortCompat,
  connect,
  createEmptyDoc,
  moveNode,
  removeEdge,
  removeNode,
  resetSelection,
  setPending,
  updateNode,
  type CanvasState,
  type Point,
  type PortRef,
} from "../state/canvas";
import {
  AgentCard,
  EntryCard,
  ParallelBranchesCard,
  ParallelItemsCard,
  PublisherCard,
  ReducerCard,
  RouterCard,
  SequentialCard,
} from "./NodeCard";
import type { Compat } from "../state/canvas";

type Props = {
  initial?: GraphDoc;
  width?: number;
  height?: number;
  onEdgeSelected?: (edgeId: Id) => void;
};

export interface BuilderCanvasHandle {
  add: (node: NodeAny, at?: Point) => void;
  load: (doc: GraphDoc) => void;
  getState: () => CanvasState;
}

type PortClick = { nodeId: Id; name: string; kind: "in" | "out" };

const compatSymbol: Record<Compat, string> = {
  ok: "✔",
  warn: "⚠",
  block: "✖",
};

function buildInitialState(doc?: GraphDoc): CanvasState {
  const base = doc ? { ...doc } : createEmptyDoc("Canvas");
  const ui: CanvasState["ui"] = {};
  base.nodes.forEach((node, idx) => {
    ui[node.id] = {
      id: node.id,
      position: {
        x: 120 + (idx % 3) * 280,
        y: 120 + Math.floor(idx / 3) * 220,
      },
    };
  });
  return { doc: base, ui, selection: null };
}

function renderConfig(node: NodeAny, onChange: (n: NodeAny) => void): React.ReactNode {
  switch (node.kind) {
    case "entry.form":
      return <EntryCard node={node} onChange={onChange} />;
    case "agent":
      return <AgentCard node={node} onChange={onChange} />;
    case "sequential":
      return <SequentialCard node={node} onChange={onChange} />;
    case "router.llm":
      return <RouterCard node={node} onChange={onChange} />;
    case "parallel.items":
      return <ParallelItemsCard node={node} onChange={onChange} />;
    case "parallel.branches":
      return <ParallelBranchesCard node={node} onChange={onChange} />;
    case "reducer":
      return <ReducerCard node={node} onChange={onChange} />;
    case "publisher":
      return <PublisherCard node={node} onChange={onChange} />;
    default:
      return null;
  }
}

const PortBadge: React.FC<{
  node: NodeAny;
  kind: "in" | "out";
  name: string;
  schemaType?: BasicType;
  compat?: Compat | null;
  selected?: boolean;
  onClick: (info: PortClick) => void;
}> = ({ node, kind, name, schemaType, compat, selected, onClick }) => {
  const className = [
    "ab-port",
    `ab-port-${kind}`,
    compat ? `ab-port-compat-${compat}` : "",
    selected ? "ab-port-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={className}
      onClick={() => onClick({ nodeId: node.id, name, kind })}
      title={`${kind}:${name}${schemaType ? ` (${schemaType})` : ""}`}
      aria-label={`${kind} port ${name}`}
    >
      <span className="ab-port-name">{name}</span>
      {schemaType ? <span className="ab-port-type">{schemaType}</span> : null}
      {compat ? <span className="ab-port-compat" aria-label={`compat-${compat}`}>{compatSymbol[compat]}</span> : null}
    </button>
  );
};

export const BuilderCanvas = forwardRef<BuilderCanvasHandle, Props>(
  ({ initial, width = 1600, height = 1000, onEdgeSelected }, ref) => {
    const [state, setState] = useState<CanvasState>(() => buildInitialState(initial));
    const [drag, setDrag] = useState<{ id: Id; offset: Point } | null>(null);

    useEffect(() => {
      if (initial) {
        setState(buildInitialState(initial));
      }
    }, [initial]);

    useEffect(() => {
      if (!drag) return;
      const handleMove = (event: MouseEvent) => {
        const to = {
          x: event.clientX - drag.offset.x,
          y: event.clientY - drag.offset.y,
        };
        setState((prev) => moveNode(prev, drag.id, to));
      };
      const handleUp = () => setDrag(null);
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      return () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
    }, [drag]);

    const handlePortClick = useCallback(
      (info: PortClick) => {
        if (info.kind === "out") {
          setState((prev) => {
            const current = prev.pendingConnection?.from;
            if (current && current.nodeId === info.nodeId && current.port === info.name) {
              return setPending(prev, undefined);
            }
            return setPending(prev, { from: { nodeId: info.nodeId, port: info.name } });
          });
          return;
        }
        setState((prev) => {
          const pending = prev.pendingConnection?.from;
          if (!pending) {
            return prev;
          }
          const next = connect(prev, pending, { nodeId: info.nodeId, port: info.name });
          if (next.selection?.edgeId && next !== prev) {
            onEdgeSelected?.(next.selection.edgeId);
          }
          return setPending(next, undefined);
        });
      },
      [onEdgeSelected],
    );

    const handleRemoveNode = (id: Id) => {
      setState((prev) => removeNode(prev, id));
    };

    const handleNodeChange = (nextNode: NodeAny) => {
      setState((prev) => updateNode(prev, nextNode));
    };

    useImperativeHandle(
      ref,
      () => ({
        add(node, at = { x: 80, y: 80 }) {
          setState((prev) => addNode(prev, node, at));
        },
        load(doc: GraphDoc) {
          setState(buildInitialState(doc));
        },
        getState() {
          return state;
        },
      }),
      [state],
    );

    const nodeCards = useMemo(
      () =>
        state.doc.nodes.map((node) => {
          const ui = state.ui[node.id] ?? { id: node.id, position: { x: 80, y: 80 } };
          return { node, ui };
        }),
      [state.doc.nodes, state.ui],
    );

    const pendingFrom = state.pendingConnection?.from;

    return (
      <div className="ab-canvas" style={{ width, height }} aria-label="Builder canvas">
        {nodeCards.map(({ node, ui }) => {
          const inputs = node.inputs ?? [];
          const outputs = node.outputs ?? [];
          const compatMap = new Map<string, Compat>();
          if (pendingFrom) {
            inputs.forEach((input) => {
              compatMap.set(
                input.name,
                checkPortCompat(state.doc, pendingFrom, { nodeId: node.id, port: input.name }),
              );
            });
          }
          return (
            <div
              key={node.id}
              className="ab-node-wrap"
              style={{ left: ui.position.x, top: ui.position.y }}
              onMouseDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                setDrag({
                  id: node.id,
                  offset: {
                    x: event.clientX - ui.position.x,
                    y: event.clientY - ui.position.y,
                  },
                });
              }}
              role="group"
              aria-label={`Node ${node.name ?? node.kind}`}
            >
              <div className="ab-node">
                <div className="ab-node-header">
                  <div className="ab-node-title">{node.name ?? node.kind}</div>
                  <button
                    type="button"
                    className="ab-node-remove"
                    aria-label="Remove node"
                    onClick={() => handleRemoveNode(node.id)}
                  >
                    x
                  </button>
                </div>

                {inputs.length > 0 && (
                  <div className="ab-ports ab-ports-in">
                    {inputs.map((port) => (
                      <PortBadge
                        key={port.name}
                        node={node}
                        kind="in"
                        name={port.name}
                        schemaType={port.schema.type}
                        compat={compatMap.get(port.name) ?? null}
                        onClick={handlePortClick}
                      />
                    ))}
                  </div>
                )}

                {outputs.length > 0 && (
                  <div className="ab-ports ab-ports-out">
                    {outputs.map((port) => (
                      <PortBadge
                        key={port.name}
                        node={node}
                        kind="out"
                        name={port.name}
                        schemaType={port.schema.type}
                        selected={pendingFrom?.nodeId === node.id && pendingFrom.port === port.name}
                        onClick={handlePortClick}
                      />
                    ))}
                  </div>
                )}

                {renderConfig(
                  node,
                  (next) => handleNodeChange(next as NodeAny),
                )}
              </div>
            </div>
          );
        })}

        <ul className="ab-edge-list" aria-label="Edges">
          {state.doc.edges.map((edge) => (
            <li key={edge.id}>
              <button
                type="button"
                className={`ab-edge${state.selection?.edgeId === edge.id ? " ab-edge--active" : ""}`}
                onClick={() => {
                  setState((prev) => ({ ...prev, selection: { edgeId: edge.id } }));
                  onEdgeSelected?.(edge.id);
                }}
              >
                {edge.from.nodeId}:{edge.from.port} -> {edge.to.nodeId}:{edge.to.port}
              </button>
              <button
                type="button"
                className="ab-edge-remove"
                aria-label="remove edge"
                onClick={() => setState((prev) => removeEdge(prev, edge.id))}
              >
                x
              </button>
            </li>
          ))}
        </ul>

        <div className="ab-canvas-toolbar">
          <button type="button" className="ab-toolbar-btn" onClick={() => setState((prev) => resetSelection(prev))}>
            Clear selection
          </button>
          <span>Connect ports to create edges.</span>
        </div>
      </div>
    );
  },
);

BuilderCanvas.displayName = "BuilderCanvas";
