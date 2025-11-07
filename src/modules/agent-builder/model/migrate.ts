import { IR_VERSION, GraphDoc } from "./ir";

export type AnyDoc = { version?: string } & Record<string, unknown>;

type LegacyNode = {
  kind?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
};

type LegacyDoc = {
  nodes?: LegacyNode[];
  version?: string;
  id?: string;
  name?: string;
  meta?: Record<string, unknown>;
  edges?: unknown[];
} & Record<string, unknown>;

export function migrateToCurrent(doc: AnyDoc): GraphDoc {
  if (doc.version === IR_VERSION) {
    return doc as GraphDoc;
  }
  if (!doc.version || doc.version === "0.2") {
    return migrate02to03(doc as LegacyDoc);
  }
  throw new Error(`Unsupported IR version: ${doc.version ?? "�"}`);
}

function migrate02to03(doc02: LegacyDoc): GraphDoc {
  const cloned: LegacyDoc = JSON.parse(JSON.stringify(doc02));
  for (const node of cloned.nodes ?? []) {
    if (node.kind === "entry.file") {
      node.kind = "entry.form";
      node.config = { ...(node.config ?? {}), withMessages: true };
    }
  }
  cloned.version = IR_VERSION;
  cloned.id ||= `graph_${Math.random().toString(36).slice(2)}`;
  cloned.name ||= "Untitled";
  cloned.meta ||= {};
  cloned.edges ||= [];
  cloned.nodes ||= [];
  return cloned as GraphDoc;
}
