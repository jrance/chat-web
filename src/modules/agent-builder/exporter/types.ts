import type { Edge, Id, NodeAny } from "../model/ir";

export type EngineNode = {
  id: Id;
  kind: NodeAny["kind"];
  config?: Record<string, unknown>;
  inputs?: NodeAny["inputs"];
  outputs?: NodeAny["outputs"];
  meta?: Record<string, unknown>;
};

export type EngineGraph = {
  version: "eng-0.1";
  id: Id;
  name: string;
  nodes: Record<Id, EngineNode>;
  edges: Edge[];
  entry?: Id;
  warnings?: string[];
};
