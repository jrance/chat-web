import type { Edge } from "../model/ir";
import type { CanvasState } from "./canvas";

export function addEdges(state: CanvasState, edges: Edge[]): CanvasState {
  if (edges.length === 0) {
    return state;
  }
  return {
    ...state,
    doc: {
      ...state.doc,
      edges: [...state.doc.edges, ...edges],
    },
  };
}
