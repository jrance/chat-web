import {
  IR_VERSION,
  type BasicType,
  type Edge,
  type EdgeMapping,
  type GraphDoc,
  type Id,
  type NodeAny,
  type PortSchema,
} from "../model/ir";

export type Point = { x: number; y: number };
export type NodeUi = { id: Id; position: Point; width?: number; height?: number };
export type PortRef = { nodeId: Id; port: string };
export type Selection =
  | { nodeId?: Id; edgeId?: Id; port?: { nodeId: Id; name: string; kind: "in" | "out" } }
  | null;

export interface CanvasState {
  doc: GraphDoc;
  ui: Record<Id, NodeUi>;
  selection: Selection;
  pendingConnection?: { from?: PortRef; to?: PortRef };
}

export function nano(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function createEmptyDoc(name = "Untitled"): GraphDoc {
  return {
    version: IR_VERSION,
    id: `g_${nano()}`,
    name,
    nodes: [],
    edges: [],
    meta: {},
  };
}

function withEventsMeta<T extends NodeAny>(node: T): T {
  const meta = { ...(node.meta ?? {}) } as Record<string, unknown> & { events?: string[] };
  if (!Array.isArray(meta.events)) {
    meta.events = [];
  }
  return { ...node, meta };
}

export function addNode(state: CanvasState, node: NodeAny, at: Point): CanvasState {
  const nextNode = withEventsMeta(node);
  const ui: NodeUi = { id: nextNode.id, position: at };
  return {
    ...state,
    doc: { ...state.doc, nodes: [...state.doc.nodes, nextNode] },
    ui: { ...state.ui, [nextNode.id]: ui },
    selection: { nodeId: nextNode.id },
  };
}

export function removeNode(state: CanvasState, nodeId: Id): CanvasState {
  const edges = state.doc.edges.filter(
    (edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId,
  );
  const nodes = state.doc.nodes.filter((node) => node.id !== nodeId);
  const { [nodeId]: _, ...restUi } = state.ui;
  const nextSelection =
    state.selection && state.selection.nodeId === nodeId
      ? null
      : state.selection && state.selection.edgeId
        ? state.selection
        : null;
  return {
    ...state,
    doc: { ...state.doc, nodes, edges },
    ui: restUi,
    selection: nextSelection,
  };
}

export function updateNode(state: CanvasState, updated: NodeAny): CanvasState {
  const nodes = state.doc.nodes.map((node) => (node.id === updated.id ? updated : node));
  return {
    ...state,
    doc: { ...state.doc, nodes },
  };
}

export function moveNode(state: CanvasState, nodeId: Id, to: Point): CanvasState {
  const current = state.ui[nodeId];
  if (!current) {
    return state;
  }
  return {
    ...state,
    ui: {
      ...state.ui,
      [nodeId]: { ...current, position: to },
    },
  };
}

export function removeEdge(state: CanvasState, edgeId: Id): CanvasState {
  const edges = state.doc.edges.filter((edge) => edge.id !== edgeId);
  return { ...state, doc: { ...state.doc, edges }, selection: null };
}

export function getNode(doc: GraphDoc, id: Id): NodeAny | undefined {
  return doc.nodes.find((node) => node.id === id);
}

export function portSchemaOf(node: NodeAny, kind: "in" | "out", portName: string): PortSchema | undefined {
  const ports = kind === "in" ? node.inputs ?? [] : node.outputs ?? [];
  return ports.find((port) => port.name === portName)?.schema;
}

export type Compat = "ok" | "warn" | "block";

export function basicCompat(a?: BasicType, b?: BasicType): Compat {
  if (!a || !b) {
    return "warn";
  }
  if (a === b) {
    return "ok";
  }
  const soft = new Set<BasicType>(["object", "array"]);
  if (soft.has(a) && soft.has(b)) {
    return "warn";
  }
  if (a === "artifact" || b === "artifact") {
    return "block";
  }
  return "block";
}

export function checkPortCompat(doc: GraphDoc, from: PortRef, to: PortRef): Compat {
  const src = getNode(doc, from.nodeId);
  const dst = getNode(doc, to.nodeId);
  if (!src || !dst) {
    return "block";
  }
  const outSchema = portSchemaOf(src, "out", from.port);
  const inSchema = portSchemaOf(dst, "in", to.port);
  return basicCompat(outSchema?.type, inSchema?.type);
}

export function connect(state: CanvasState, from: PortRef, to: PortRef): CanvasState {
  if (from.nodeId === to.nodeId && from.port === to.port) {
    return state;
  }
  const compat = checkPortCompat(state.doc, from, to);
  if (compat === "block") {
    return { ...state, selection: null };
  }
  const dupe = state.doc.edges.some(
    (edge) =>
      edge.from.nodeId === from.nodeId &&
      edge.from.port === from.port &&
      edge.to.nodeId === to.nodeId &&
      edge.to.port === to.port,
  );
  if (dupe) {
    return state;
  }
  const edge: Edge = { id: `e_${nano()}`, from, to, mappings: [] };
  return {
    ...state,
    doc: { ...state.doc, edges: [...state.doc.edges, edge] },
    selection: { edgeId: edge.id },
  };
}

export function setPending(state: CanvasState, pending?: { from?: PortRef; to?: PortRef }): CanvasState {
  return { ...state, pendingConnection: pending };
}

export function resetSelection(state: CanvasState): CanvasState {
  return { ...state, selection: null };
}

export function updateEdgeMappings(state: CanvasState, edgeId: Id, mappings: EdgeMapping[]): CanvasState {
  const edges = state.doc.edges.map((edge) => (edge.id === edgeId ? { ...edge, mappings } : edge));
  return { ...state, doc: { ...state.doc, edges } };
}
