import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  Connection,
  Node as RFNode,
  Edge as RFEdge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { IRNode } from "../model/ir";
import GenericNode from "./nodes/GenericNode";
import RouterNode from "./nodes/RouterNode";
import CodelessAgentNode from "./nodes/CodelessAgentNode";
import ToolNode from "./nodes/ToolNode";
import MCPServerNode from "./nodes/MCPServerNode";

export function Canvas(): JSX.Element {
  const { state, dispatch } = useAgentBuilder();
  const rf = useReactFlow();

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const edge: RFEdge = {
        id: uuidv4(),
        source: conn.source,
        target: conn.target,
        label: undefined,
      };
      const edges = addEdge(edge, state.edges);
      dispatch({ type: "SET_FLOW", nodes: state.nodes, edges });
      dispatch({ type: "SELECT_EDGE", id: edge.id });
    },
    [dispatch, state.edges, state.nodes]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/x-agentbuilder-kind");
      if (!kind) return;
      const pos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let label = defaultLabelForKind(kind);
      let data: any = { label };
      if (kind === "tool") {
        const tooldefText = event.dataTransfer.getData("application/x-agentbuilder-tooldef");
        if (tooldefText) {
          try {
            const td = JSON.parse(tooldefText);
            label = td.displayName || td.name || label;
            data = { label, toolId: td.toolId, version: td.version };
          } catch {}
        }
      }
      const node: RFNode = {
        id: uuidv4(),
        type: kind,
        data,
        position: pos,
      };
      const nodes = [...state.nodes, node];
      dispatch({ type: "SET_FLOW", nodes, edges: state.edges });
      dispatch({ type: "SELECT_NODE", id: node.id });
    },
    [dispatch, rf, state.edges, state.nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodeClick = useCallback((_e: any, n: RFNode) => dispatch({ type: "SELECT_NODE", id: n.id }), [dispatch]);
  const onEdgeClick = useCallback((_e: any, ed: RFEdge) => dispatch({ type: "SELECT_EDGE", id: ed.id }), [dispatch]);
  const onNodeDragStart = useCallback((_e: any, n: RFNode) => dispatch({ type: "SELECT_NODE", id: n.id }), [dispatch]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const defaultEdgeOptions = useMemo(
    () => ({
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#cbd5f5" },
      style: { strokeWidth: 2 },
    }),
    []
  );
  const nodeTypes = useMemo(
    () => ({
      router: RouterNode,
      sequential: GenericNode,
      concurrent: GenericNode,
      groupchat: GenericNode,
      output: GenericNode,
      "agent.codeless": CodelessAgentNode,
      "agent.byoe": GenericNode,
      "agent.remote": GenericNode,
      mcpServer: MCPServerNode,
      tool: ToolNode,
    }),
    []
  );

  return (
    <div
      className={`ab-canvas${state.ir.meta?.metadata && (state.ir.meta.metadata as any).showToolNodesOnCanvas === false ? " ab-canvas--hide-tool-nodes" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (state.selectedNodeId) dispatch({ type: "REMOVE_NODE", id: state.selectedNodeId });
          if (state.selectedEdgeId) dispatch({ type: "REMOVE_EDGE", id: state.selectedEdgeId });
        }
      }}
    >
      <ReactFlow
        nodes={state.nodes}
        edges={state.edges}
        defaultEdgeOptions={defaultEdgeOptions}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onNodesChange={(changes) => dispatch({ type: "SET_FLOW", nodes: applyNodeChanges(changes, state.nodes), edges: state.edges })}
        onEdgesChange={(changes) => dispatch({ type: "SET_FLOW", nodes: state.nodes, edges: applyEdgeChanges(changes, state.edges) })}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStart={onNodeDragStart}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        proOptions={proOptions}
      >
        <MiniMap className="ab-minimap" />
        <Controls position="bottom-left" />
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

function defaultLabelForKind(kind: string) {
  switch (kind) {
    case "router":
      return "Router";
    case "sequential":
      return "Sequential";
    case "concurrent":
      return "Concurrent";
    case "groupchat":
      return "GroupChat";
    case "output":
      return "Output";
    case "agent.codeless":
      return "Codeless Agent";
    case "agent.byoe":
      return "BYOE Agent";
    case "agent.remote":
      return "Remote Agent";
    case "tool":
      return "Tool";
    default:
      return kind;
  }
}
