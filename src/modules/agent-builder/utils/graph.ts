import { Edge as RFEdge, Node as RFNode } from "reactflow";
import { IRGraph, IRNode, IREdge } from "../model/ir";

export function listChildren(ir: IRGraph, parentId: string): IRNode[] {
  const childIds = ir.edges.filter((e) => e.from === parentId).map((e) => e.to);
  return ir.nodes.filter((n) => childIds.includes(n.id));
}

export function ensureUniqueSiblingLabels(ir: IRGraph, parentId: string): string[] {
  const labels = new Map<string, number>();
  const errors: string[] = [];
  for (const child of listChildren(ir, parentId)) {
    const count = (labels.get(child.label) ?? 0) + 1;
    labels.set(child.label, count);
  }
  labels.forEach((count, label) => {
    if (count > 1) errors.push(`Duplicate label among siblings: "${label}"`);
  });
  return errors;
}

export function addEdge(ir: IRGraph, edge: IREdge): IRGraph {
  return { ...ir, edges: [...ir.edges, edge] };
}

export function addNode(ir: IRGraph, node: IRNode): IRGraph {
  return { ...ir, nodes: [...ir.nodes, node] };
}

export function removeNode(ir: IRGraph, nodeId: string): IRGraph {
  return {
    ...ir,
    nodes: ir.nodes.filter((n) => n.id !== nodeId),
    edges: ir.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
  };
}

export function updateNodeLabel(ir: IRGraph, nodeId: string, label: string): IRGraph {
  return {
    ...ir,
    nodes: ir.nodes.map((n) => (n.id === nodeId ? { ...n, label } : n)),
  };
}

export function selectedEdge(edges: RFEdge[], id?: string | null): RFEdge | null {
  if (!id) return null;
  return edges.find((e) => e.id === id) ?? null;
}

