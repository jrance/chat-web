import { createContext, useContext, useMemo, useReducer } from "react";
import { Edge, Node } from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { IRGraph, IRNode, IREdge } from "../model/ir";
import { irToReactFlow } from "../utils/reactflowAdapters";
import { syncRouterEnum } from "../utils/routerEnumSync";
import { layout } from "../hooks/useDagreLayout";
import { Node as RFNode, Edge as RFEdge } from "reactflow";

type State = {
  ir: IRGraph;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  autoTidyOnSave: boolean;
  dirty: boolean;
  openTestForNodeId?: string;
  rightPanelMode?: "inspector" | "test";
};

type Action =
  | { type: "SET_GRAPH"; ir: IRGraph }
  | { type: "SET_FLOW"; nodes: Node[]; edges: Edge[] }
  | { type: "SELECT_NODE"; id?: string }
  | { type: "SELECT_EDGE"; id?: string }
  | { type: "ADD_NODE"; node: IRNode }
  | { type: "ADD_EDGE"; edge: IREdge }
  | { type: "UPDATE_NODE_LABEL"; id: string; label: string }
  | { type: "UPDATE_EDGE_LABEL"; id: string; label: string }
  | { type: "REMOVE_NODE"; id: string }
  | { type: "REMOVE_EDGE"; id: string }
  | { type: "TIDY" }
  | { type: "SET_AUTO_TIDY"; value: boolean }
  | { type: "SET_DIRTY"; value: boolean }
  | { type: "OPEN_TEST"; nodeId: string }
  | { type: "SHOW_TEST_PANEL" }
  | { type: "SHOW_INSPECTOR_PANEL" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GRAPH": {
      // If the IR node ids match the current canvas nodes, preserve positions and just update labels/data
      const currentIds = new Set(state.nodes.map((n) => n.id));
      const irIds = new Set(action.ir.nodes.map((n) => n.id));
      const sameSet = currentIds.size === irIds.size && Array.from(irIds).every((id) => currentIds.has(id));
      if (sameSet) {
        const nodes = state.nodes.map((n) => {
          const irNode = action.ir.nodes.find((m) => m.id === n.id);
          if (!irNode) return n;
          return { ...n, type: irNode.kind, data: { ...(n.data as any), label: irNode.label, node: irNode } };
        });
        // preserve edges as-is
        return { ...state, ir: action.ir, nodes, edges: state.edges, dirty: true };
      }
      // Otherwise rebuild from IR (e.g., after Import/New)
      const { nodes, edges } = irToReactFlow(action.ir);
      return { ...state, ir: action.ir, nodes, edges, dirty: false };
    }
    case "SET_FLOW": {
      const rfNodes = action.nodes;
      const rfEdges = action.edges;

      const buildDefaultDataForKind = (kind: string): any => {
        if (kind === "router") {
          return {
            prompt: "Route to <targets>. Return JSON {target, confidence}.",
            minConfidence: 0.5,
            tieBreak: "HighestConfidence",
            tieBreakPrefer: [],
            fallback: { mode: "AskUserClarify" },
            allowBelowMinForTieBreak: false,
            routeSchema: {
              type: "object",
              properties: {
                target: { type: "string", enum: [] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                rationale: { type: "string" },
              },
              required: ["target"],
            },
            telemetry: { labels: {} },
            targets: [],
            autoSyncEnum: true,
          };
        }
        if (kind === "sequential") {
          return {
            breakOn: "Never",
            childrenOrder: [],
            childOverrides: {},
          };
        }
        if (kind === "agent.codeless")
          return {
            systemInstructions: "",
            styleGuide: "",
            model: {
              provider: "openai",
              modelId: "",
              temperature: 0.3,
              topP: 1,
              maxTokens: 800,
              seed: null,
              stop: [],
              jsonModeEnabled: false,
            },
            context: { historyWindow: { mode: "LastN", n: 10 }, injectOrgPreamble: true, vars: {} },
            tools: { policy: "Disabled", timeoutMs: 10000, maxCallsPerTurn: 0, parallelism: 1, redactPII: true, attached: [] },
            structuredOutput: { enabled: false, schema: {}, onViolation: "RetryAndRepair", maxRepairAttempts: 2, postProcess: { normalizeWhitespace: true, ensureMarkdown: true } },
            safety: { policyRef: "enterprise-v3", onBlock: "Refuse", piiRedaction: true, promptInjectionDefense: true },
            telemetry: { labels: {}, emitUsage: true },
          };
        if (kind === "tool") return { name: "Tool", toolId: undefined, version: undefined, parameterOverrides: {} };
        return {};
      };

      const newIRNodes: IRNode[] = rfNodes.map((rn: RFNode) => {
        const existing = state.ir.nodes.find((n) => n.id === rn.id);
        if (existing) {
          return { ...existing, label: (rn.data as any)?.label ?? existing.label } as IRNode;
        }
        const kind = String(rn.type);
        const baseData = buildDefaultDataForKind(kind);
        // Incorporate initial RN data for specific kinds (e.g., tool drag with catalog info)
        const mergedData = (() => {
          if (kind === "tool") {
            const td = (rn.data as any) || {};
            return { ...baseData, toolId: td.toolId ?? (baseData as any).toolId, version: td.version ?? (baseData as any).version, parameterOverrides: (baseData as any).parameterOverrides || {} } as any;
          }
          return baseData;
        })();
        const base: IRNode = {
          id: rn.id,
          kind: kind as any,
          label: (rn.data as any)?.label ?? kind,
          description: undefined,
          data: mergedData,
        } as any;
        return base;
      });

      const rfIds = new Set(rfNodes.map((n) => n.id));
      const filteredIRNodes = newIRNodes.filter((n) => rfIds.has(n.id));

      const newIREdges: IREdge[] = rfEdges.map((e: RFEdge) => ({ id: e.id, from: e.source, to: e.target, label: e.label as string | undefined }));

      let ir: IRGraph = { ...state.ir, nodes: filteredIRNodes, edges: newIREdges };

      for (const n of ir.nodes) {
        // No-op: argsSchema not required for Tool nodes
        if (n.kind === "router" && (n as any).data?.autoSyncEnum) {
          ir = syncRouterEnum(ir, n.id);
        }
        if (n.kind === "sequential") {
          const out = ir.edges.filter((e) => e.from === n.id).map((e) => e.to);
          const current = ((n as any).data?.childrenOrder as string[] | undefined) ?? [];
          const next = [...current.filter((id) => out.includes(id)), ...out.filter((id) => !current.includes(id))];
          if (JSON.stringify(next) !== JSON.stringify(current)) {
            ir = {
              ...ir,
              nodes: ir.nodes.map((m) => (m.id === n.id ? { ...m, data: { ...(m as any).data, childrenOrder: next } } as any : m)),
            };
          }
          const cov = ((n as any).data?.childOverrides as any) || {};
          const pruned: any = {};
          for (const cid of next) if (cov[cid]) pruned[cid] = cov[cid];
          ir = { ...ir, nodes: ir.nodes.map((m) => (m.id === n.id ? { ...m, data: { ...(m as any).data, childOverrides: pruned } } as any : m)) };
        }
        if (n.kind === "agent.codeless") {
          // Sync connected tool nodes into data.tools.attached based on graph edges
          const outToolIds = ir.edges
            .filter((e) => e.from === n.id)
            .map((e) => e.to)
            .filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const inToolIds = ir.edges
            .filter((e) => e.to === n.id)
            .map((e) => e.from)
            .filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const attached = Array.from(new Set([...outToolIds, ...inToolIds]));
          const d: any = (n as any).data || {};
          const prev: string[] = (d?.tools?.attached as string[] | undefined) || [];
          if (JSON.stringify(prev) !== JSON.stringify(attached)) {
            const nextTools = { ...(d.tools || {}), attached };
            ir = {
              ...ir,
              nodes: ir.nodes.map((m) => (m.id === n.id ? ({ ...m, data: { ...d, tools: nextTools } } as any) : m)),
            };
          }
        }
      }

      return { ...state, nodes: rfNodes, edges: rfEdges, ir, dirty: true };
    }
    case "SELECT_NODE":
      return { ...state, selectedNodeId: action.id, selectedEdgeId: undefined, rightPanelMode: "inspector" };
    case "SELECT_EDGE":
      return { ...state, selectedEdgeId: action.id, selectedNodeId: undefined, rightPanelMode: "inspector" };
    case "ADD_NODE": {
      const ir = { ...state.ir, nodes: [...state.ir.nodes, action.node] };
      const { nodes, edges } = irToReactFlow(ir);
      return { ...state, ir, nodes, edges, dirty: true };
    }
    case "ADD_EDGE": {
      let ir = { ...state.ir, edges: [...state.ir.edges, action.edge] };
      // If source is a router, sync enum
      const source = state.ir.nodes.find((n) => n.id === action.edge.from);
      if (source?.kind === "router") ir = syncRouterEnum(ir, source.id);
      if (source?.kind === "sequential" || source?.kind === "concurrent") {
        const sn = ir.nodes.find((n) => n.id === source.id) as any;
        const order: string[] = (sn?.data?.childrenOrder as string[] | undefined) ?? [];
        const next = order.includes(action.edge.to) ? order : [...order, action.edge.to];
        ir = { ...ir, nodes: ir.nodes.map((n) => (n.id === source.id ? { ...n, data: { ...((n as any).data || {}), childrenOrder: next } } as any : n)) };
      }
      // Sync codeless attachments after edge add
      for (const n of ir.nodes) {
        if (n.kind === "agent.codeless") {
          const outToolIds = ir.edges.filter((e) => e.from === n.id).map((e) => e.to).filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const inToolIds = ir.edges.filter((e) => e.to === n.id).map((e) => e.from).filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const attached = Array.from(new Set([...outToolIds, ...inToolIds]));
          const d: any = (n as any).data || {};
          const prev: string[] = (d?.tools?.attached as string[] | undefined) || [];
          if (JSON.stringify(prev) !== JSON.stringify(attached)) {
            const nextTools = { ...(d.tools || {}), attached };
            ir = { ...ir, nodes: ir.nodes.map((m) => (m.id === n.id ? ({ ...m, data: { ...d, tools: nextTools } } as any) : m)) };
          }
        }
      }
      const { nodes, edges } = irToReactFlow(ir);
      return { ...state, ir, nodes, edges, dirty: true };
    }
    case "UPDATE_NODE_LABEL": {
      const ir = { ...state.ir, nodes: state.ir.nodes.map((n) => (n.id === action.id ? { ...n, label: action.label } : n)) };
      const nodes = state.nodes.map((n) => (n.id === action.id ? { ...n, data: { ...(n.data as any), label: action.label } } : n));
      return { ...state, ir, nodes, edges: state.edges, dirty: true };
    }
    case "UPDATE_EDGE_LABEL": {
      let ir = { ...state.ir, edges: state.ir.edges.map((e) => (e.id === action.id ? { ...e, label: action.label } : e)) };
      const changed = state.ir.edges.find((e) => e.id === action.id);
      if (changed) {
        const srcNode = state.ir.nodes.find((n) => n.id === changed.from);
        if (srcNode?.kind === "router") ir = syncRouterEnum(ir, srcNode.id);
      }
      const { nodes, edges } = irToReactFlow(ir);
      return { ...state, ir, nodes, edges, dirty: true };
    }
    case "REMOVE_NODE": {
      const ir = { ...state.ir, nodes: state.ir.nodes.filter((n) => n.id !== action.id), edges: state.ir.edges.filter((e) => e.from !== action.id && e.to !== action.id) };
      // Sync codeless attachments after node removal
      let updatedIr = ir;
      for (const n of updatedIr.nodes) {
        if (n.kind === "agent.codeless") {
          const outToolIds = updatedIr.edges.filter((e) => e.from === n.id).map((e) => e.to).filter((tid) => (updatedIr.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const inToolIds = updatedIr.edges.filter((e) => e.to === n.id).map((e) => e.from).filter((tid) => (updatedIr.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const attached = Array.from(new Set([...outToolIds, ...inToolIds]));
          const d: any = (n as any).data || {};
          const prev: string[] = (d?.tools?.attached as string[] | undefined) || [];
          if (JSON.stringify(prev) !== JSON.stringify(attached)) {
            const nextTools = { ...(d.tools || {}), attached };
            updatedIr = { ...updatedIr, nodes: updatedIr.nodes.map((m) => (m.id === n.id ? ({ ...m, data: { ...d, tools: nextTools } } as any) : m)) };
          }
        }
      }
      const nodes = state.nodes.filter((n) => n.id !== action.id);
      const edges = state.edges.filter((e) => e.source !== action.id && e.target !== action.id);
      return { ...state, ir: updatedIr, nodes, edges, selectedNodeId: undefined, dirty: true };
    }
    case "REMOVE_EDGE": {
      const removed = state.ir.edges.find((e) => e.id === action.id);
      let ir = { ...state.ir, edges: state.ir.edges.filter((e) => e.id !== action.id) };
      if (removed) {
        const srcNode = state.ir.nodes.find((n) => n.id === removed.from);
        if (srcNode?.kind === "router") ir = syncRouterEnum(ir, srcNode.id);
        if (srcNode?.kind === "sequential" || srcNode?.kind === "concurrent") {
          const sn = ir.nodes.find((n) => n.id === srcNode.id) as any;
          const order: string[] = (sn?.data?.childrenOrder as string[] | undefined) ?? [];
          const next = order.filter((id) => id !== removed.to);
          const cov = ((sn?.data?.childOverrides as any) || {});
          delete cov[removed.to];
          ir = {
            ...ir,
            nodes: ir.nodes.map((n) => (n.id === srcNode.id ? { ...n, data: { ...((n as any).data || {}), childrenOrder: next, childOverrides: cov } } as any : n)),
          };
        }
      }
      // Sync codeless attachments after edge removal
      for (const n of ir.nodes) {
        if (n.kind === "agent.codeless") {
          const outToolIds = ir.edges.filter((e) => e.from === n.id).map((e) => e.to).filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const inToolIds = ir.edges.filter((e) => e.to === n.id).map((e) => e.from).filter((tid) => (ir.nodes.find((m) => m.id === tid)?.kind) === "tool");
          const attached = Array.from(new Set([...outToolIds, ...inToolIds]));
          const d: any = (n as any).data || {};
          const prev: string[] = (d?.tools?.attached as string[] | undefined) || [];
          if (JSON.stringify(prev) !== JSON.stringify(attached)) {
            const nextTools = { ...(d.tools || {}), attached };
            ir = { ...ir, nodes: ir.nodes.map((m) => (m.id === n.id ? ({ ...m, data: { ...d, tools: nextTools } } as any) : m)) };
          }
        }
      }
      const { nodes, edges } = irToReactFlow(ir);
      return { ...state, ir, nodes, edges, selectedEdgeId: undefined, dirty: true };
    }
    case "TIDY": {
      const { nodes, edges } = layout(state.nodes, state.edges, "TB");
      // only positions changed; keep IR data; edges/nodes unchanged
      const ir = state.ir;
      return { ...state, nodes, edges, ir };
    }
    case "SET_AUTO_TIDY":
      return { ...state, autoTidyOnSave: action.value };
    case "SET_DIRTY":
      return { ...state, dirty: action.value };
    case "OPEN_TEST":
      return { ...state, openTestForNodeId: action.nodeId };
    case "SHOW_TEST_PANEL":
      return { ...state, rightPanelMode: "test" };
    case "SHOW_INSPECTOR_PANEL":
      return { ...state, rightPanelMode: "inspector" };
    default:
      return state;
  }
}

export type AgentBuilderContextValue = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const AgentBuilderContext = createContext<AgentBuilderContextValue | undefined>(undefined);

export function AgentBuilderProvider({ children }: { children: React.ReactNode }) {
  const initial: State = useMemo(() => {
    const now = new Date();
    const id = uuidv4();
    const ir: IRGraph = {
      meta: { id, name: "Untitled Graph", version: "1.0.0", metadata: { showToolNodesOnCanvas: true } },
      nodes: [],
      edges: [],
      entryId: undefined,
    };
    const { nodes, edges } = irToReactFlow(ir);
    return { ir, nodes, edges, autoTidyOnSave: false, dirty: false, rightPanelMode: "inspector" };
  }, []);

  const [state, dispatch] = useReducer(reducer, initial);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AgentBuilderContext.Provider value={value}>{children}</AgentBuilderContext.Provider>;
}

export function useAgentBuilder() {
  const ctx = useContext(AgentBuilderContext);
  if (!ctx) throw new Error("useAgentBuilder must be used within AgentBuilderProvider");
  return ctx;
}
