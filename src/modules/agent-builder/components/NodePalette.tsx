import type { NodeAny, NodeKind } from "../model/ir";
import { nano } from "../state/canvas";
import React from "react";

type Props = {
  onCreate: (node: NodeAny) => void;
};

const palette: Array<{ kind: NodeKind; label: string; hint: string }> = [
  { kind: "entry.form", label: "Entry (Chat/Form)", hint: "Start from chat input, form data, and files" },
  { kind: "agent", label: "Agent", hint: "Single LLM turn with optional tool access" },
  { kind: "sequential", label: "Sequential", hint: "Execute child nodes in order" },
  { kind: "router.llm", label: "Router (LLM)", hint: "Route to one child based on LLM decision" },
  { kind: "parallel.items", label: "Parallel (Items)", hint: "Fan-out over array items with a worker" },
  { kind: "parallel.branches", label: "Parallel (Branches)", hint: "Run fixed children concurrently" },
  { kind: "reducer", label: "Reducer", hint: "Fan-in results with list_concat" },
  { kind: "publisher", label: "Publisher", hint: "Upload/publish final artifact" },
];

function withMeta<T extends NodeAny>(node: T): T {
  return { ...node, meta: { ...(node.meta ?? {}), events: [] } };
}

function makeNode(kind: NodeKind): NodeAny {
  const id = `n_${nano()}`;
  switch (kind) {
    case "entry.form":
      return withMeta({
        id,
        kind,
        outputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "form", schema: { type: "object" } },
          { name: "files", schema: { type: "array" } },
        ],
        config: { withMessages: true },
      });
    case "agent":
      return withMeta({
        id,
        kind,
        name: "LLM Agent",
        config: { allowedTools: [] },
        inputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "context", schema: { type: "object" } },
        ],
        outputs: [
          { name: "text", schema: { type: "string" } },
          { name: "output", schema: { type: "object" } },
        ],
      });
    case "sequential":
      return withMeta({
        id,
        kind,
        name: "Sequential",
        config: { children: [] },
        outputs: [{ name: "result", schema: { type: "object" } }],
      });
    case "router.llm":
      return withMeta({
        id,
        kind,
        name: "Router",
        config: { branches: [], returnConfidence: true },
        inputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "context", schema: { type: "object" } },
        ],
        outputs: [{ name: "route", schema: { type: "object" } }],
      });
    case "parallel.items":
      return withMeta({
        id,
        kind,
        name: "Parallel Items",
        config: { concurrency: 4, workerId: `worker_${nano()}`, itemPort: "items" },
        inputs: [
          { name: "items", required: true, schema: { type: "array" } },
          { name: "concurrency", schema: { type: "number" } },
        ],
        outputs: [{ name: "results", schema: { type: "array" } }],
      });
    case "parallel.branches":
      return withMeta({
        id,
        kind,
        name: "Parallel Branches",
        config: { children: [], broadcast: ["messages", "context"], join: "all" },
        inputs: [
          { name: "messages", schema: { type: "array" } },
          { name: "context", schema: { type: "object" } },
        ],
        outputs: [{ name: "evidence", schema: { type: "array", reducer: "list_concat" } }],
      });
    case "reducer":
      return withMeta({
        id,
        kind,
        name: "Reducer",
        config: { strategy: "list_concat" },
        inputs: [{ name: "items", required: true, schema: { type: "array" } }],
        outputs: [{ name: "results", schema: { type: "array" } }],
      });
    case "publisher":
      return withMeta({
        id,
        kind,
        name: "Publisher",
        config: { destination: "sharepoint", path: "/Shared Documents/output.csv" },
        inputs: [
          { name: "artifact", required: true, schema: { type: "artifact" } },
          { name: "metadata", schema: { type: "object" } },
        ],
        outputs: [{ name: "url", schema: { type: "string" } }],
      });
  }
}

export const NodePalette: React.FC<Props> = ({ onCreate }) => {
  return (
    <div className="ab-palette" role="list">
      {palette.map((item) => (
        <button
          key={item.kind}
          type="button"
          className="ab-palette-item"
          role="listitem"
          title={item.hint}
          onClick={() => onCreate(makeNode(item.kind))}
          data-kind={item.kind}
        >
          <div className="ab-palette-label">{item.label}</div>
          <div className="ab-palette-hint">{item.hint}</div>
        </button>
      ))}
    </div>
  );
};

