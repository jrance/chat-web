import type { GraphDoc, Id } from "../model/ir";
import type { EngineGraph, EngineNode } from "./types";

export type CompileWarnings = string[];

function indexNodes(doc: GraphDoc): Record<Id, EngineNode> {
  const map: Record<Id, EngineNode> = {};
  for (const node of doc.nodes) {
    map[node.id] = {
      id: node.id,
      kind: node.kind,
      config: ((node as any).config ?? {}) as Record<string, unknown>,
      inputs: node.inputs,
      outputs: node.outputs,
      meta: node.meta ?? {},
    };
  }
  return map;
}

function findEntry(doc: GraphDoc): Id | undefined {
  return doc.nodes.find((node) => node.kind === "entry.form")?.id;
}

export function compileGraph(doc: GraphDoc): { graph: EngineGraph; warnings: CompileWarnings } {
  const warnings: CompileWarnings = [];
  const nodes = indexNodes(doc);
  const edges = doc.edges ?? [];

  for (const edge of edges) {
    const from = nodes[edge.from.nodeId];
    const to = nodes[edge.to.nodeId];
    if (!from) {
      warnings.push(`edge(${edge.id}): missing from.nodeId='${edge.from.nodeId}'`);
    }
    if (!to) {
      warnings.push(`edge(${edge.id}): missing to.nodeId='${edge.to.nodeId}'`);
    }
    if (from) {
      const portNames = new Set((from.outputs ?? []).map((p) => p.name));
      if (!portNames.has(edge.from.port)) {
        warnings.push(`edge(${edge.id}): from.port '${edge.from.port}' not found on node '${from.id}'`);
      }
    }
    if (to) {
      const portNames = new Set((to.inputs ?? []).map((p) => p.name));
      if (!portNames.has(edge.to.port)) {
        warnings.push(`edge(${edge.id}): to.port '${edge.to.port}' not found on node '${to.id}'`);
      }
    }
    if (!edge.mappings || edge.mappings.length === 0) {
      warnings.push(`edge(${edge.id}): mappings missing`);
    }
  }

  for (const node of Object.values(nodes)) {
    if (node.kind === "parallel.items") {
      const workerId = (node.config as any)?.workerId;
      if (!workerId || !nodes[workerId]) {
        warnings.push(`parallel.items(${node.id}): workerId missing or invalid (${workerId ?? "undefined"})`);
      }
    }
  }

  const graph: EngineGraph = {
    version: "eng-0.1",
    id: doc.id,
    name: doc.name,
    nodes,
    edges: edges.map((edge) => ({ ...edge })),
    entry: findEntry(doc),
    warnings: warnings.length ? warnings : undefined,
  };

  return { graph, warnings };
}
