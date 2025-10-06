import dagre from "dagre";
import { Node, Edge, Position } from "reactflow";

export type Direction = "LR" | "TB";

const nodeSizeHints: Record<string, { width: number; height: number }> = {
  router: { width: 220, height: 72 },
  sequential: { width: 220, height: 72 },
  concurrent: { width: 240, height: 88 },
  groupchat: { width: 260, height: 96 },
  output: { width: 160, height: 56 },
  "agent.codeless": { width: 260, height: 120 },
  "agent.byoe": { width: 260, height: 120 },
  "agent.remote": { width: 260, height: 120 },
  tool: { width: 200, height: 64 },
};

export function layout(nodes: Node[], edges: Edge[], direction: Direction = "TB"): { nodes: Node[]; edges: Edge[] } {
  const isLR = direction === "LR";
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40, edgesep: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const size = nodeSizeHints[n.type as string] ?? { width: 200, height: 72 };
    g.setNode(n.id, size);
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const laidOutNodes = nodes.map((n) => {
    const { width, height } = nodeSizeHints[n.type as string] ?? { width: 200, height: 72 };
    const nodeWithPosition = g.node(n.id);
    return {
      ...n,
      targetPosition: isLR ? Position.Left : Position.Top,
      sourcePosition: isLR ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: laidOutNodes, edges };
}
