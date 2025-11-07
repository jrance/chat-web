
# PR‑AB‑006 — Parallel (Branches) Broadcast UX + Combiner & Evidence Fan‑In

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001/002/003/004/005  
**Scope:** Ship a full UI/IR flow for **parallel.branches**: configure **broadcast** of chat/context/history to children, auto‑wire **branch edges**, and **fan‑in** child outputs as `evidence[]` (list‑concat). Add a **Combiner Agent** mode that accepts `evidence` plus messages/context to synthesize a final answer/report.  
**Coverage target:** **≥80%** (Vitest + RTL).

---

## Tenets

1. **Spec‑first**
   - Use existing IR v0.3 `parallel.branches` with `config.children`, `config.broadcast`, `config.join`.
   - Evidence fan‑in is realized via `outputs: [{ name: "evidence", schema: { type: "array", reducer: "list_concat" } }]` on the `parallel.branches` node and **edge mappings** from each child back into it with `reduce: "list_concat"`.

2. **Codeless UX**
   - A **Broadcast Builder** lets users choose what to send to each child: `messages`, `context`, and optional extra fields (JSONPath list).
   - A **Branch Wire Wizard** auto‑creates edges to children and back from children into `evidence[]` with sensible default mappings.

3. **Determinism & Observability**
   - Broadcast rules are declarative, persisted in `parallel.branches.config`.  
   - Evidence schema hints appear in the Combiner config (no runtime LLM calls at design‑time).

4. **Quality**
   - Pure helpers for graph mutations.  
   - Tests for wizard wiring, broadcast persistence, and combiner port behavior.

---

## IR notes (no breaking changes)

- `ParallelBranchesNode.config.broadcast?: string[]` already exists (from PR‑AB‑003). In this PR, treat values as **top‑level keys** available on the upstream payload. Recommended defaults: `["messages","context"]`.
- Evidence is just an array of arbitrary objects; document the recommended **evidence contract** (below). No IR change needed.

### Recommended evidence contract (for users & code examples)

Each branch child should output **one** of the following (wizard will prompt which output to use):
```ts
type Evidence = {
  source: string;             // e.g., "sharepoint" | "onedrive" | "news"
  text?: string;              // optional synthesized text from child
  data?: Record<string, any>; // structured object, e.g., matched row/metadata
  artifacts?: Array<{ file_id: string; display_name: string; mime_type: string }>;
  confidence?: number;        // 0..1
  meta?: Record<string, any>; // any child-specific detail
};
```
The combiner agent will receive `evidence: Evidence[]` and may produce a synthesized summary `text` or an artifact (e.g., markdown or JSON).

---

## File changes (under `src/modules/agent-builder`)

### 1) **NEW** `components/NodeCard/ParallelBranchesCard.tsx` — Broadcast & children editor

```tsx
// src/modules/agent-builder/components/NodeCard/ParallelBranchesCard.tsx
import React, { useMemo } from "react";
import type { ParallelBranchesNode, NodeAny, Id } from "../../model/ir";

type Props = {
  node: ParallelBranchesNode;
  onChange: (next: ParallelBranchesNode) => void;
  allNodes: NodeAny[];                 // to pick children from existing nodes
  onOpenWireWizard: (parentId: Id) => void;
};

export const ParallelBranchesCard: React.FC<Props> = ({ node, onChange, allNodes, onOpenWireWizard }) => {
  const c = node.config;
  const candidates = useMemo(() => allNodes.filter(n =>
    n.id !== node.id && n.kind !== "entry.form" // avoid selecting self/entry as child
  ), [allNodes, node.id]);

  const toggleBroadcast = (key: string) => {
    const set = new Set(c.broadcast ?? []);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange({ ...node, config: { ...c, broadcast: Array.from(set) } });
  };

  const toggleChild = (id: Id) => {
    const set = new Set(c.children ?? []);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ ...node, config: { ...c, children: Array.from(set) } });
  };

  const join = c.join;

  return (
    <div className="ab-card">
      <div className="ab-field">
        <label className="ab-label">Children (run in parallel)</label>
        <div className="ab-list">
          {candidates.map(n => (
            <label key={n.id} className="ab-checkline">
              <input type="checkbox" checked={!!(c.children ?? []).includes(n.id)} onChange={() => toggleChild(n.id)} />
              <span>{n.name ?? n.kind} — <code>{n.id}</code></span>
            </label>
          ))}
        </div>
        <small className="ab-help">Choose the nodes to execute concurrently.</small>
      </div>

      <div className="ab-field">
        <label className="ab-label">Broadcast</label>
        <label className="ab-checkline"><input type="checkbox" checked={(c.broadcast ?? []).includes("messages")} onChange={() => toggleBroadcast("messages")} /> messages</label>
        <label className="ab-checkline"><input type="checkbox" checked={(c.broadcast ?? []).includes("context")} onChange={() => toggleBroadcast("context")} /> context</label>
        <small className="ab-help">Broadcast fields are forwarded to every child as baseline inputs.</small>
      </div>

      <div className="ab-field">
        <label className="ab-label">Join Policy</label>
        <select
          className="ab-select"
          value={typeof join === "string" ? join : "custom"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "all" || v === "any") onChange({ ...node, config: { ...c, join: v } });
            else onChange({ ...node, config: { ...c, join: { timeoutMs: 15000, policy: "partial" } as any } });
          }}
        >
          <option value="all">all — wait for all children</option>
          <option value="any">any — first child to complete</option>
          <option value="custom">custom — timeout/partial</option>
        </select>
        {typeof join !== "string" && (
          <div className="ab-grid-2">
            <label>Timeout (ms)</label>
            <input
              className="ab-input"
              type="number"
              value={join.timeoutMs}
              onChange={(e) => onChange({ ...node, config: { ...c, join: { ...join, timeoutMs: Number(e.target.value || 0) } } as any })}
            />
            <label>Policy</label>
            <select
              className="ab-select"
              value={join.policy}
              onChange={(e) => onChange({ ...node, config: { ...c, join: { ...join, policy: e.target.value as any } } as any })}
            >
              <option value="partial">partial — proceed with what finished</option>
              <option value="fail">fail — treat timeout as error</option>
            </select>
          </div>
        )}
      </div>

      <div className="ab-actions">
        <button className="ab-btn" onClick={() => onOpenWireWizard(node.id)}>Open Branch Wire Wizard</button>
      </div>

      <div className="ab-note">
        <strong>Evidence Fan‑In</strong>: each child should map its result to the parent’s <code>evidence</code> output via
        an edge mapping with <code>reduce: "list_concat"</code>. Use the wizard to auto‑wire these mappings.
      </div>
    </div>
  );
};
```

---

### 2) **NEW** `components/Wizard/BranchWireWizard.tsx` — auto‑wire helper

```tsx
// src/modules/agent-builder/components/Wizard/BranchWireWizard.tsx
import React, { useMemo, useState } from "react";
import type { GraphDoc, Id, NodeAny, Edge, EdgeMapping } from "../../model/ir";
import { getNode } from "../../state/canvas";

type Props = {
  doc: GraphDoc;
  parentId: Id;                              // parallel.branches node
  onApply: (edgesToAdd: Edge[]) => void;
  onClose: () => void;
};

type EdgePlan = { from: { nodeId: Id; port: string }, to: { nodeId: Id; port: string }, mappings: EdgeMapping[] };

export const BranchWireWizard: React.FC<Props> = ({ doc, parentId, onApply, onClose }) => {
  const parent = getNode(doc, parentId) as any;
  const broadcast = (parent?.config?.broadcast ?? []) as string[];
  const children: NodeAny[] = (parent?.config?.children ?? []).map((id: Id) => getNode(doc, id)).filter(Boolean) as any[];

  const [sourcePort, setSourcePort] = useState<string>("messages");
  const [childTargetPort, setChildTargetPort] = useState<string>("messages");
  const [childResultPort, setChildResultPort] = useState<string>("output"); // what child port maps back as evidence
  const [evidenceFieldJsonPath, setEvidenceFieldJsonPath] = useState<string>("$"); // default: whole child output

  const edgePlans: EdgePlan[] = useMemo(() => {
    const plans: EdgePlan[] = [];
    // 1) parent → child (broadcast sourcePort to childTargetPort)
    for (const child of children) {
      plans.push({
        from: { nodeId: parentId, port: sourcePort },
        to: { nodeId: child.id, port: childTargetPort },
        mappings: [{
          from: `$${sourcePort === "messages" ? ".messages" : sourcePort === "context" ? ".context" : ""}`.replace(/\.\./g, "."),
          to: childTargetPort
        } as EdgeMapping]
      });
      // 2) child → parent (childResultPort → evidence with list_concat)
      plans.push({
        from: { nodeId: child.id, port: childResultPort },
        to:   { nodeId: parentId, port: "evidence" },
        mappings: [{
          from: evidenceFieldJsonPath, // "$" by default: entire child result
          to: "evidence",
          reduce: "list_concat"
        } as EdgeMapping]
      });
    }
    return plans;
  }, [children, childResultPort, childTargetPort, evidenceFieldJsonPath, parentId, sourcePort]);

  const edgesToAdd: Edge[] = edgePlans.map((p, idx) => ({
    id: `wizard_${idx}`,
    from: p.from,
    to: p.to,
    mappings: p.mappings
  }));

  return (
    <aside className="ab-wizard">
      <header className="ab-wizard-header">
        <strong>Branch Wire Wizard</strong>
        <button className="ab-btn" onClick={onClose}>Close</button>
      </header>

      <section className="ab-wizard-body">
        <div className="ab-grid-2">
          <div>
            <label>Broadcast source from parent</label>
            <select className="ab-select" value={sourcePort} onChange={(e) => setSourcePort(e.target.value)}>
              <option value="messages" disabled={!broadcast.includes("messages")}>messages</option>
              <option value="context" disabled={!broadcast.includes("context")}>context</option>
            </select>
          </div>
          <div>
            <label>Target input on child</label>
            <select className="ab-select" value={childTargetPort} onChange={(e) => setChildTargetPort(e.target.value)}>
              <option value="messages">messages</option>
              <option value="context">context</option>
            </select>
          </div>
        </div>

        <div className="ab-grid-2">
          <div>
            <label>Child result port</label>
            <select className="ab-select" value={childResultPort} onChange={(e) => setChildResultPort(e.target.value)}>
              <option value="output">output</option>
              <option value="text">text</option>
            </select>
          </div>
          <div>
            <label>Evidence JSONPath from child result</label>
            <input
              className="ab-input"
              value={evidenceFieldJsonPath}
              onChange={(e) => setEvidenceFieldJsonPath(e.target.value)}
              placeholder="$"
            />
            <small className="ab-help">Use <code>$</code> for the full result or a path like <code>$.data</code>.</small>
          </div>
        </div>

        <div className="ab-preview">
          <label>Edges to add</label>
          <pre className="ab-pre">{JSON.stringify(edgesToAdd, null, 2)}</pre>
        </div>
      </section>

      <footer className="ab-wizard-actions">
        <button className="ab-btn ab-btn-primary" onClick={() => onApply(edgesToAdd)}>Apply</button>
      </footer>
    </aside>
  );
};
```

---

### 3) **UPDATE** `components/NodeCard/AgentCard.tsx` — Combiner mode

Adds an optional **Combiner** toggle. When enabled, the Agent node exposes an extra required input port `evidence` of type `array`.

```tsx
// src/modules/agent-builder/components/NodeCard/AgentCard.tsx
import React from "react";
import type { AgentNode, InputPort } from "../../model/ir";

type Props = { node: AgentNode; onChange: (next: AgentNode) => void };

export const AgentCard: React.FC<Props> = ({ node, onChange }) => {
  const cfg = node.config ?? {};
  const isCombiner = !!(node.meta as any)?.combiner;

  const toggleCombiner = (checked: boolean) => {
    const inputs = node.inputs ?? [];
    const hasEvidence = inputs.some(p => p.name === "evidence");
    let nextInputs = inputs;
    if (checked && !hasEvidence) {
      nextInputs = [...inputs, { name: "evidence", schema: { type: "array" }, required: true } as InputPort];
    } else if (!checked && hasEvidence) {
      nextInputs = inputs.filter(p => p.name !== "evidence");
    }
    onChange({ ...node, inputs: nextInputs, meta: { ...(node.meta ?? {}), combiner: checked } });
  };

  return (
    <div className="ab-card">
      <label>Model</label>
      <input className="ab-input" type="text" value={cfg.model ?? ""} onChange={(e) => onChange({ ...node, config: { ...cfg, model: e.target.value } })} />
      <div className="ab-field">
        <label className="ab-checkline">
          <input type="checkbox" checked={isCombiner} onChange={(e) => toggleCombiner(e.target.checked)} /> Combiner mode (expects <code>evidence[]</code>)
        </label>
        <small className="ab-help">Adds an <code>evidence</code> input port. Map from the parent’s <code>evidence</code> output.</small>
      </div>
    </div>
  );
};
```

---

### 4) **NEW** `state/graph_ops.ts` — addEdges helper

```ts
// src/modules/agent-builder/state/graph_ops.ts
import type { CanvasState } from "./canvas";
import type { Edge } from "../model/ir";

export function addEdges(state: CanvasState, edges: Edge[]): CanvasState {
  return { ...state, doc: { ...state.doc, edges: [...state.doc.edges, ...edges] } };
}
```

---

### 5) **Styles** (extend builder CSS)

```css
/* Wizard */
.ab-wizard { position: absolute; right: 0; top: 0; width: 560px; height: 100%; background: var(--card); border-left: 1px solid var(--line); display: flex; flex-direction: column; }
.ab-wizard-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.ab-wizard-body { padding: 8px 12px; display: grid; gap: 10px; }
.ab-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ab-wizard-actions { padding: 8px 12px; display: flex; justify-content: flex-end; border-top: 1px solid var(--line); }
.ab-checkline { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.ab-note { font-size: 12px; opacity: 0.9; margin-top: 8px; }
```

---

## Tests

```
src/modules/agent-builder/components/NodeCard/__tests__/ParallelBranchesCard.spec.tsx
src/modules/agent-builder/components/Wizard/__tests__/BranchWireWizard.spec.tsx
src/modules/agent-builder/components/NodeCard/__tests__/AgentCard.combiner.spec.tsx
```

**`ParallelBranchesCard.spec.tsx`** — broadcast & children toggles

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParallelBranchesCard } from "../../ParallelBranchesCard";

const allNodes = [
  { id: "a", kind: "agent" },
  { id: "b", kind: "agent" }
] as any;

describe("ParallelBranchesCard", () => {
  it("toggles children and broadcast", () => {
    const node = { id: "p", kind: "parallel.branches", config: { children: [], broadcast: ["messages"], join: "all" } } as any;
    const onChange = (next: any) => Object.assign(node, next);
    render(<ParallelBranchesCard node={node} onChange={onChange} allNodes={allNodes} onOpenWireWizard={() => {}} />);
    fireEvent.click(screen.getByLabelText(/context/));
    expect(node.config.broadcast).toContain("context");
  });
});
```

**`BranchWireWizard.spec.tsx`** — plan & apply wiring

```tsx
import { describe, it, expect, fireEvent, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BranchWireWizard } from "../../Wizard/BranchWireWizard";

const doc = {
  version: "0.3",
  id: "g",
  name: "t",
  nodes: [
    { id: "p", kind: "parallel.branches", config: { children: ["c1","c2"], broadcast: ["messages"], join: "all" }, outputs: [{ name: "evidence", schema: { type: "array", reducer: "list_concat" } }] },
    { id: "c1", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }], outputs: [{ name: "output", schema: { type: "object" } }] },
    { id: "c2", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }], outputs: [{ name: "output", schema: { type: "object" } }] }
  ],
  edges: []
} as any;

describe("BranchWireWizard", () => {
  it("produces two fwd edges and two fan-in edges", () => {
    const onApply = vi.fn();
    render(<BranchWireWizard doc={doc} parentId="p" onApply={onApply} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalled();
    const edges = onApply.mock.calls[0][0];
    // 4 edges: p→c1, p→c2, c1→p, c2→p
    expect(edges).toHaveLength(4);
    expect(edges.filter((e: any) => e.to.nodeId === "p").length).toBe(2);
    expect(edges.filter((e: any) => e.from.nodeId === "p").length).toBe(2);
  });
});
```

**`AgentCard.combiner.spec.tsx`** — evidence port exposure

```tsx
import { describe, it, expect, fireEvent } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "../../AgentCard";

describe("AgentCard (Combiner)", () => {
  it("adds evidence input when combiner enabled", () => {
    const node: any = { id: "a", kind: "agent", inputs: [{ name: "messages", schema: { type: "array" } }, { name: "context", schema: { type: "object" } }], config: {} };
    const onChange = (next: any) => Object.assign(node, next);
    render(<AgentCard node={node} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Combiner mode/));
    expect(node.inputs.some((p: any) => p.name === "evidence")).toBe(true);
  });
});
```

---

## Acceptance Criteria

- **ParallelBranchesCard**
  - Choose child nodes; configure `broadcast` (`messages`, `context`) and `join` policy (`all`/`any`/custom timeout).  
  - “Open Branch Wire Wizard” opens the wizard with the parent id.

- **Branch Wire Wizard**
  - Displays planned edges for: **parent→child** (broadcasted source→child target port) and **child→parent** (child result→`evidence` with `reduce: "list_concat"`).  
  - Apply returns an array of IR `Edge` objects suitable for insertion.  
  - Users can pick source (messages/context), target child port, child result port (`output|text`), and evidence JSONPath (`$` by default).

- **Combiner Agent**
  - Agent card exposes a **Combiner mode** toggle; when enabled, adds a required input port `evidence` (type `array`).  
  - Typical wiring: `parallel.branches.evidence` → `combiner_agent.evidence`, plus messages/context as usual.

- **Tests** pass with **≥80%** coverage on new files.

---

## How to Review & Integrate

1. Mount `ParallelBranchesCard` for `parallel.branches` in your node property panel. Pass `allNodes` and `onOpenWireWizard` to open the wizard.  
2. On wizard “Apply”, call your graph state helper to append the returned edges (e.g., `addEdges`).  
3. When configuring a Combiner Agent, enable the toggle and wire `evidence` from the parent using the Data Mapper (PR‑AB‑004).  
4. Exporter (PR‑AB‑008) will read these edges/mappings and emit the engine request envelope accordingly.

---

## Follow‑ups

- **PR‑AB‑007:** Tool registry & per‑tool schema picker for Agent nodes.  
- **PR‑AB‑008:** Exporter + runtime samples (how parallel.branches compiles into the engine request).  
- **PR‑AB‑009:** Telemetry stream stubs (design‑time) and SSE wiring in the preview panel.
