import { Edge, Node, Position } from "reactflow";
import { IRGraph, IRNode, IREdge } from "../model/ir";

export function irToReactFlow(ir: IRGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = ir.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    data: { label: n.label, node: n },
    position: { x: 0, y: 0 },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));

  const edges: Edge[] = ir.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.label,
    animated: false,
  }));

  return { nodes, edges };
}

export function reactFlowToIR(ir: IRGraph, nodes: Node[], edges: Edge[]): IRGraph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const updatedNodes: IRNode[] = ir.nodes.map((n) => {
    const rn = nodeMap.get(n.id);
    if (!rn) return n;
    // write back label updates from data
    const label = (rn.data as any)?.label ?? n.label;
    return { ...n, label } as IRNode;
  });

  const updatedEdges: IREdge[] = edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: e.label as string | undefined,
  }));

  return { ...ir, nodes: updatedNodes, edges: updatedEdges };
}
