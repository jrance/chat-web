
# PR‑AB‑004 — Data Mapper (Edges) + Mapping Engine

**Repo:** `jrance/chat-web`  
**Module:** `src/modules/agent-builder`  
**Branch base:** `feature/codex-collab`  
**Depends on:** PR‑AB‑001 (IR v0.3), PR‑AB‑002 (Unified Entry), PR‑AB‑003 (Node Palette & Canvas)  
**Scope:** Ship a **Data Mapper** that lets users wire outputs→inputs with **JSONPath**, **transforms**, **defaults**, and **validators**. Implement a pure **mapping engine** used by the UI and exporter. Provide a **Mapper Drawer** that opens when an edge is selected on the canvas, with live preview and type hints.  
**Coverage target:** **≥80%** for new files (Vitest + React Testing Library).

---

## Tenets

1. **Spec‑first & Typed** — Implements `EdgeMapping` ←→ UI 1:1 with IR v0.3. Mapping engine is pure and easily testable.  
2. **Codeless by Design** — Users never write code; they compose JSONPath + transforms + validations visually with live preview.  
3. **Determinism** — Transform & validator semantics are explicit; errors are surfaced in the UI and do not mutate the graph on failure.  
4. **Interoperability** — JSONPath adapter prefers `jsonpath-plus` if present, otherwise a **safe MVP evaluator** supports common paths.  
5. **Quality** — High coverage on transform pipelines, validator errors, and drawer interactions.

---

## File changes (all under `src/modules/agent-builder`)

### 1) **NEW** `lib/jsonpath.ts` — adapter with safe fallback

```ts
// src/modules/agent-builder/lib/jsonpath.ts
/* Lightweight JSONPath adapter.
 * - If "jsonpath-plus" is available, use it.
 * - Else, fallback to a safe MVP evaluator that supports:
 *   $.a.b, $.a[0], $.a[*], $.a.b[*].c
 * No eval, no filters. Returns array of matches.
 */
export type JsonPath = string;

type EvalFn = (root: unknown, path: JsonPath) => any[];

let impl: EvalFn | null = null;

function fallbackEval(root: any, path: string): any[] {
  if (!path || path[0] != "$") return [];
  // Strip leading $ and split on dots while keeping bracket parts
  // Very small subset: $.a.b, $.a[0], $.a[*], $.a.b[*].c
  const segs: string[] = [];
  let buf = "";
  for (let i = 1; i < path.length; i++) {
    const ch = path[i];
    if (ch === "." && buf.indexOf("[") === -1) {
      if (buf) { segs.push(buf); buf = ""; }
    } else {
      buf += ch;
    }
  }
  if (buf) segs.push(buf);

  let current: any[] = [root];
  for (const seg of segs) {
    const next: any[] = [];
    for (const node of current) {
      if (node == null) continue;
      const m = /^([^\[]+)(\[([^\]]+)\])?$/.exec(seg); // name [index|*]?
      if (!m) continue;
      const key = m[1];
      const idx = m[3];
      const obj = node[key];
      if (idx == null) {
        if (obj !== undefined) next.push(obj);
      } else if (idx === "*") {
        if (Array.isArray(obj)) next.push(...obj);
        else if (obj && typeof obj === "object") next.push(...Object.values(obj));
      } else {
        const n = Number(idx);
        if (Array.isNaN(n)) continue;
        if (Array.isArray(obj) && obj[n] !== undefined) next.push(obj[n]);
      }
    }
    current = next;
  }
  return current;
}

export function evalJsonPath(root: unknown, path: JsonPath): any[] {
  if (!impl) {
    try {
      // Lazy import if available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { JSONPath } = require("jsonpath-plus");
      impl = (r, p) => JSONPath({ path: p, json: r });
    } catch {
      impl = fallbackEval;
    }
  }
  return impl(root, path);
}
```

---

### 2) **NEW** `lib/mapper.ts` — pure mapping engine

```ts
// src/modules/agent-builder/lib/mapper.ts
import type { Edge, EdgeMapping, Transform, Validator } from "../model/ir";
import { evalJsonPath } from "./jsonpath";

export type MapError = { kind: "jsonpath" | "transform" | "validator"; message: string };
export type MapResult<T = unknown> = { ok: true; value: T } | { ok: false; errors: MapError[] };

export function runJsonPath(source: unknown, jsonPath: string): MapResult<unknown> {
  try {
    const hits = evalJsonPath(source, jsonPath);
    // If 0 hits, undefined; if 1 hit, return it; if many, return array
    if (!hits.length) return { ok: true, value: undefined };
    return { ok: true, value: hits.length === 1 ? hits[0] : hits };
  } catch (e: any) {
    return { ok: false, errors: [{ kind: "jsonpath", message: e?.message ?? "JSONPath failed" }] };
  }
}

/** ---------- Transforms ---------- */

function t_to_number(v: unknown): unknown {
  if (v == null || v === "") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}
function t_clamp(v: unknown, min?: number, max?: number): unknown {
  if (typeof v !== "number") return v;
  if (min != null && v < min) return min;
  if (max != null && v > max) return max;
  return v;
}
function t_wrap_array(v: unknown): unknown {
  return Array.isArray(v) ? v : (v == null ? [] : [v]);
}
function t_pick(v: unknown, paths: string[]): unknown {
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    const val = evalJsonPath(v, p);
    if (val.length === 1) out[p] = val[0];
    else out[p] = val;
  }
  return out;
}
function t_merge(v: unknown, obj: Record<string, unknown>): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as any), ...obj };
  }
  return { ...obj, value: v };
}
function t_to_string(v: unknown): unknown {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try { return JSON.stringify(v); } catch { return String(v); }
}
function t_to_boolean(v: unknown): unknown {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}
function t_parse_date(v: unknown): unknown {
  if (typeof v === "string" || typeof v === "number") {
    const t = Date.parse(v as any);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return v;
}
function t_regex_replace(v: unknown, pattern: string, replacement: string, flags?: string): unknown {
  if (typeof v !== "string") return v;
  try {
    const rx = new RegExp(pattern, flags);
    return v.replace(rx, replacement);
  } catch {
    return v;
  }
}

export function applyTransforms(v: unknown, transforms?: Transform[]): unknown {
  if (!transforms?.length) return v;
  let cur = v;
  for (const t of transforms) {
    switch (t.kind) {
      case "to_number": cur = t_to_number(cur); break;
      case "clamp": cur = t_clamp(cur, t.min, t.max); break;
      case "wrap_array": cur = t_wrap_array(cur); break;
      case "pick": cur = t_pick(cur, t.paths); break;
      case "merge": cur = t_merge(cur, t.obj); break;
      case "to_string": cur = t_to_string(cur); break;
      case "to_boolean": cur = t_to_boolean(cur); break;
      case "parse_date": cur = t_parse_date(cur); break;
      case "regex_replace": cur = t_regex_replace(cur, t.pattern, t.replacement, t.flags); break;
      default: break;
    }
  }
  return cur;
}

/** ---------- Validators ---------- */

function v_required(v: unknown): boolean {
  return !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));
}
function v_min(v: unknown, min: number): boolean {
  return typeof v === "number" ? v >= min : true;
}
function v_max(v: unknown, max: number): boolean {
  return typeof v === "number" ? v <= max : true;
}
function v_regex(v: unknown, pattern: string, flags?: string): boolean {
  if (typeof v !== "string") return true;
  try { return new RegExp(pattern, flags).test(v); } catch { return true; }
}
function v_enum(v: unknown, values: Array<string|number|boolean>): boolean {
  return values.includes(v as any);
}

export function runValidators(v: unknown, validators?: Validator[]): MapResult<unknown> {
  if (!validators?.length) return { ok: true, value: v };
  const errors: MapError[] = [];
  for (const val of validators) {
    const pass = (
      val.kind === "required" ? v_required(v) :
      val.kind === "min" ? v_min(v, val.value) :
      val.kind === "max" ? v_max(v, val.value) :
      val.kind === "regex" ? v_regex(v, val.pattern, val.flags) :
      val.kind === "enum" ? v_enum(v, val.values) : true
    );
    if (!pass) errors.push({ kind: "validator", message: `failed: ${val.kind}` });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}

/** ---------- Public API ---------- */

export function applyMapping(source: unknown, m: EdgeMapping): MapResult<unknown> {
  const out: MapError[] = [];
  const jp = runJsonPath(source, m.from);
  if (!jp.ok) return jp;
  let v = jp.value;
  v = applyTransforms(v, m.transforms);
  if ((v === undefined || v === null) && m.default !== undefined) v = m.default;
  const vr = runValidators(v, m.validators);
  if (!vr.ok) return vr;
  return { ok: true, value: v };
}

/** Evaluate all mappings on an edge, returning a single object keyed by `to` fields.
 * - If multiple mappings assign the same `to`, the last one wins (MVP behavior).
 * - If a mapping has reduce="list_concat", the value must be array and concatenates into the target array.
 */
export function applyEdgeMappings(source: unknown, mappings: EdgeMapping[]): MapResult<Record<string, unknown>> {
  const acc: Record<string, unknown> = {};
  const errors: MapError[] = [];
  for (const m of (mappings ?? [])) {
    const r = applyMapping(source, m);
    if (!r.ok) { errors.push(...r.errors); continue; }
    if (m.reduce === "list_concat") {
      const cur = acc[m.to];
      const arr = Array.isArray(r.value) ? r.value : (r.value == null ? [] : [r.value]);
      acc[m.to] = Array.isArray(cur) ? [...cur, ...arr] : arr;
    } else {
      acc[m.to] = r.value;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: acc };
}
```

---

### 3) **NEW** `components/MapperDrawer.tsx` — the UI

```tsx
// src/modules/agent-builder/components/MapperDrawer.tsx
import React, { useMemo, useState } from "react";
import type { GraphDoc, Edge, EdgeMapping, Id } from "../model/ir";
import { getNode } from "../state/canvas";
import { applyEdgeMappings } from "../lib/mapper";

type SourcePreview = { label: string; value: unknown };

type Props = {
  doc: GraphDoc;
  edgeId: Id;
  upstreamPreview?: Record<string, unknown>; // optional: example values for 'from' JSONPath
  onChange: (nextMappings: EdgeMapping[]) => void;
  onClose: () => void;
};

function MappingRow({ mapping, onChange, onRemove, previewSource } : {
  mapping: EdgeMapping;
  onChange: (m: EdgeMapping) => void;
  onRemove: () => void;
  previewSource?: unknown;
}) {
  const [path, setPath] = useState(mapping.from);
  const [to, setTo] = useState(mapping.to);
  const [defaultVal, setDefaultVal] = useState<string>(mapping.default as any ?? "");
  const [preview, setPreview] = useState<string>("");

  const runPreview = () => {
    const { applyMapping } = require("../lib/mapper");
    const r = applyMapping(previewSource, { ...mapping, from: path, to, default: defaultVal === "" ? undefined : defaultVal });
    setPreview(r.ok ? JSON.stringify(r.value) : (r.errors[0]?.message ?? "error"));
  };

  return (
    <div className="ab-map-row">
      <div className="ab-row-main">
        <div className="ab-col">
          <label>JSONPath (from)</label>
          <input className="ab-input" value={path} onChange={(e) => { setPath(e.target.value); onChange({ ...mapping, from: e.target.value }); }} placeholder="$.form.values.concurrency" />
        </div>
        <div className="ab-col">
          <label>Target (to)</label>
          <input className="ab-input" value={to} onChange={(e) => { setTo(e.target.value); onChange({ ...mapping, to: e.target.value }); }} placeholder="concurrency" />
        </div>
        <div className="ab-col">
          <label>Default</label>
          <input className="ab-input" value={defaultVal} onChange={(e) => { setDefaultVal(e.target.value); onChange({ ...mapping, default: e.target.value }); }} placeholder="e.g. 8" />
        </div>
        <div className="ab-col ab-col-narrow">
          <button className="ab-btn" onClick={runPreview}>Preview</button>
          {preview && <div className="ab-preview">{preview}</div>}
        </div>
        <button className="ab-row-remove" onClick={onRemove} aria-label="remove mapping">×</button>
      </div>

      <div className="ab-row-sub">
        <strong>Transforms</strong>
        {/* MVP: simple add/remove with minimal props */}
        <TransformList mapping={mapping} onChange={onChange} />
        <strong>Validators</strong>
        <ValidatorList mapping={mapping} onChange={onChange} />
        <div className="ab-reduce">
          <label><input type="checkbox" checked={mapping.reduce === "list_concat"} onChange={(e) => onChange({ ...mapping, reduce: e.target.checked ? "list_concat" : undefined })} /> reduce: list_concat</label>
        </div>
      </div>
    </div>
  );
}

function TransformList({ mapping, onChange }: { mapping: EdgeMapping; onChange: (m: EdgeMapping) => void }) {
  const t = mapping.transforms ?? [];
  const add = (kind: any) => onChange({ ...mapping, transforms: [...t, { kind }] as any });
  const remove = (i: number) => onChange({ ...mapping, transforms: t.filter((_, idx) => idx !== i) });
  return (
    <div className="ab-transform-list">
      <div className="ab-transform-chips">
        {t.map((x, i) => (
          <span className="ab-chip" key={i}>
            {x.kind}
            {x.kind === "clamp" && <> (min={x.min ?? "-"}, max={x.max ?? "-"})</>}
            <button onClick={() => remove(i)} aria-label="remove">×</button>
          </span>
        ))}
        <div className="ab-add">
          <button className="ab-btn" onClick={() => add("to_number")}>+ to_number</button>
          <button className="ab-btn" onClick={() => add("clamp")}>+ clamp</button>
          <button className="ab-btn" onClick={() => add("wrap_array")}>+ wrap_array</button>
          <button className="ab-btn" onClick={() => add("to_string")}>+ to_string</button>
          <button className="ab-btn" onClick={() => add("to_boolean")}>+ to_boolean</button>
          <button className="ab-btn" onClick={() => add("parse_date")}>+ parse_date</button>
          <button className="ab-btn" onClick={() => add("regex_replace")}>+ regex_replace</button>
        </div>
      </div>
      {t.find(x => x.kind === "clamp") && (
        <div className="ab-transform-params">
          {/* For MVP, render first clamp's params */}
          {t.map((x, i) => x.kind === "clamp" ? (
            <div key={i}>
              <label>min</label>
              <input className="ab-input" type="number" value={(x as any).min ?? ""} onChange={(e) => {
                const next = [...t]; (next[i] as any).min = e.target.value === "" ? undefined : Number(e.target.value);
                onChange({ ...mapping, transforms: next });
              }} />
              <label>max</label>
              <input className="ab-input" type="number" value={(x as any).max ?? ""} onChange={(e) => {
                const next = [...t]; (next[i] as any).max = e.target.value === "" ? undefined : Number(e.target.value);
                onChange({ ...mapping, transforms: next });
              }} />
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

function ValidatorList({ mapping, onChange }: { mapping: EdgeMapping; onChange: (m: EdgeMapping) => void }) {
  const v = mapping.validators ?? [];
  const add = (kind: any) => onChange({ ...mapping, validators: [...v, { kind }] as any });
  const remove = (i: number) => onChange({ ...mapping, validators: v.filter((_, idx) => idx !== i) });
  return (
    <div className="ab-validator-list">
      <div className="ab-validator-chips">
        {v.map((x, i) => (
          <span className="ab-chip" key={i}>
            {x.kind}
            <button onClick={() => remove(i)} aria-label="remove">×</button>
          </span>
        ))}
        <div className="ab-add">
          <button className="ab-btn" onClick={() => add("required")}>+ required</button>
          <button className="ab-btn" onClick={() => add("min")}>+ min</button>
          <button className="ab-btn" onClick={() => add("max")}>+ max</button>
          <button className="ab-btn" onClick={() => add("regex")}>+ regex</button>
          <button className="ab-btn" onClick={() => add("enum")}>+ enum</button>
        </div>
      </div>
    </div>
  );
}

export const MapperDrawer: React.FC<Props> = ({ doc, edgeId, upstreamPreview, onChange, onClose }) => {
  const edge = useMemo(() => doc.edges.find(e => e.id === edgeId), [doc, edgeId]);
  const [mappings, setMappings] = useState<EdgeMapping[]>(edge?.mappings ?? []);

  if (!edge) return null;

  const sourceNode = getNode(doc, edge.from.nodeId);
  const targetNode = getNode(doc, edge.to.nodeId);

  const addMapping = () => setMappings(m => [...m, { from: "$", to: "", transforms: [] } as EdgeMapping]);
  const removeMapping = (idx: number) => setMappings(m => m.filter((_, i) => i !== idx));
  const changeMapping = (idx: number, next: EdgeMapping) => setMappings(m => m.map((x, i) => i === idx ? next : x));

  const runEdgePreview = () => {
    const result = applyEdgeMappings(upstreamPreview ?? {}, mappings);
    return result.ok ? JSON.stringify(result.value, null, 2) : (result.errors[0]?.message ?? "error");
  };

  return (
    <aside className="ab-mapper">
      <header className="ab-mapper-header">
        <strong>Mapper</strong>
        <button className="ab-btn" onClick={onClose}>Close</button>
      </header>

      <section className="ab-mapper-meta">
        <div>From: <code>{edge.from.nodeId}:{edge.from.port}</code></div>
        <div>To: <code>{edge.to.nodeId}:{edge.to.port}</code></div>
      </section>

      <section className="ab-mapper-rows">
        {mappings.map((m, i) => (
          <MappingRow
            key={i}
            mapping={m}
            onChange={(nm) => changeMapping(i, nm)}
            onRemove={() => removeMapping(i)}
            previewSource={upstreamPreview}
          />
        ))}
        <div><button className="ab-btn" onClick={addMapping}>+ Add mapping</button></div>
      </section>

      <section className="ab-mapper-preview">
        <div className="ab-col">
          <label>Upstream Preview</label>
          <pre className="ab-pre">{JSON.stringify(upstreamPreview ?? {}, null, 2)}</pre>
        </div>
        <div className="ab-col">
          <label>Result Preview</label>
          <pre className="ab-pre">{runEdgePreview()}</pre>
        </div>
      </section>

      <footer className="ab-mapper-actions">
        <button className="ab-btn ab-btn-primary" onClick={() => onChange(mappings)}>Save</button>
      </footer>
    </aside>
  );
};
```

---

### 4) **UPDATE** `state/canvas.ts` — helper to update edge mappings

```ts
// add to src/modules/agent-builder/state/canvas.ts
import type { EdgeMapping, Id } from "../model/ir";

export function updateEdgeMappings(state: CanvasState, edgeId: Id, mappings: EdgeMapping[]): CanvasState {
  const edges = state.doc.edges.map(e => e.id === edgeId ? { ...e, mappings } : e);
  return { ...state, doc: { ...state.doc, edges } };
}
```

---

### 5) **(Optional) UPDATE** `components/BuilderCanvas.tsx` — wire `MapperDrawer`

In `BuilderCanvas`, when an edge is selected (`onEdgeSelected(edgeId)`), open `MapperDrawer` from the parent. Provide an `upstreamPreview` sample of the **source node’s output**, if available (for Entry, send `EntryOutputs` shape; for others, a small mock or last known run). On **Save**, call `updateEdgeMappings(...)` to persist.

> If you prefer, keep `MapperDrawer` mounted at a higher level (e.g., `AgentBuilderPage`) and pass `doc`, `edgeId`, and callbacks.

---

### 6) **NEW** tests

```
src/modules/agent-builder/lib/__tests__/jsonpath.spec.ts
src/modules/agent-builder/lib/__tests__/mapper.spec.ts
src/modules/agent-builder/components/__tests__/MapperDrawer.spec.tsx
```

**`jsonpath.spec.ts`** — basic subset behavior

```ts
import { describe, it, expect } from "vitest";
import { evalJsonPath } from "../../jsonpath";

describe("evalJsonPath (fallback subset)", () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }], d: { e: 3 } } };

  it("reads simple path", () => {
    expect(evalJsonPath(obj, "$.a.d.e")).toEqual([3]);
  });
  it("reads array index", () => {
    expect(evalJsonPath(obj, "$.a.b[0].c")).toEqual([1]);
  });
  it("reads wildcard array", () => {
    expect(evalJsonPath(obj, "$.a.b[*].c")).toEqual([1,2]);
  });
});
```

**`mapper.spec.ts`** — transform pipeline + validators

```ts
import { describe, it, expect } from "vitest";
import { applyMapping, applyEdgeMappings } from "../../mapper";

const source = {
  form: { values: { concurrency: "9", title: "Report 01" } },
  rows: [{ id: 1 }, { id: 2 }]
};

describe("applyMapping", () => {
  it("runs JSONPath + transforms + default + validators", () => {
    const r = applyMapping(source, {
      from: "$.form.values.concurrency",
      to: "concurrency",
      transforms: [{ kind: "to_number" }, { kind: "clamp", min: 1, max: 8 }],
      validators: [{ kind: "required" }]
    });
    expect(r.ok).toBe(true);
    // clamped to 8
    // @ts-ignore
    expect(r.value).toBe(8);
  });

  it("uses default when undefined", () => {
    const r = applyMapping(source, {
      from: "$.missing",
      to: "x",
      default: 5,
      validators: [{ kind: "required" }]
    });
    expect(r.ok).toBe(true);
    // @ts-ignore
    expect(r.value).toBe(5);
  });
});

describe("applyEdgeMappings", () => {
  it("reduces arrays with list_concat", () => {
    const r = applyEdgeMappings(source, [
      { from: "$.rows[*].id", to: "ids", reduce: "list_concat" },
      { from: "$.form.values.title", to: "title" }
    ]);
    expect(r.ok).toBe(true);
    // @ts-ignore
    expect(r.value).toEqual({ ids: [1,2], title: "Report 01" });
  });
});
```

**`MapperDrawer.spec.tsx`** — minimal interaction

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapperDrawer } from "../../MapperDrawer";

const doc = {
  version: "0.3",
  id: "g",
  name: "t",
  nodes: [
    { id: "a", kind: "entry.form", outputs: [
      { name: "messages", schema: { type: "array" } },
      { name: "form", schema: { type: "object" } },
      { name: "files", schema: { type: "array" } }
    ]},
    { id: "b", kind: "agent", inputs: [
      { name: "context", schema: { type: "object" } }
    ]}
  ],
  edges: [
    { id: "e1", from: { nodeId: "a", port: "form" }, to: { nodeId: "b", port: "context" }, mappings: [] }
  ]
} as any;

describe("MapperDrawer", () => {
  it("adds mapping rows and saves", () => {
    const onChange = vi.fn();
    render(<MapperDrawer doc={doc} edgeId="e1" upstreamPreview={{ form: { values: { concurrency: "7" } } }} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByText("+ Add mapping"));
    const jp = screen.getByPlaceholderText("$.form.values.concurrency");
    fireEvent.change(jp, { target: { value: "$.form.values.concurrency" } });
    const to = screen.getByPlaceholderText("concurrency");
    fireEvent.change(to, { target: { value: "concurrency" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onChange).toHaveBeenCalled();
  });
});
```

---

### 7) **Styles** (add to your builder CSS)

```css
/* Mapper Drawer */
.ab-mapper { position: absolute; right: 0; top: 0; width: 520px; height: 100%; background: var(--card); border-left: 1px solid var(--line); display: flex; flex-direction: column; }
.ab-mapper-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.ab-mapper-meta { padding: 8px 12px; font-size: 12px; opacity: 0.8; }
.ab-mapper-rows { padding: 8px 12px; overflow: auto; gap: 8px; display: flex; flex-direction: column; }
.ab-map-row { border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
.ab-row-main { display: grid; grid-template-columns: 1fr 1fr 1fr auto 24px; gap: 8px; align-items: end; }
.ab-row-sub { margin-top: 6px; display: grid; gap: 6px; }
.ab-col { display: flex; flex-direction: column; gap: 4px; }
.ab-col-narrow { width: 120px; }
.ab-label { font-size: 12px; opacity: 0.9; }
.ab-input, .ab-select, .ab-textarea { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
.ab-btn { border: 1px solid var(--line); border-radius: 8px; background: var(--chip); padding: 6px 10px; cursor: pointer; }
.ab-btn-primary { background: var(--brand); color: var(--brand-contrast); border-color: var(--brand); }
.ab-chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; background: var(--chip); border-radius: 12px; border: 1px solid var(--line); }
.ab-preview, .ab-pre { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px; white-space: pre-wrap; word-break: break-word; }
.ab-mapper-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.ab-mapper-actions { padding: 8px 12px; display: flex; justify-content: flex-end; gap: 8px; }
```

---

## Package updates (optional)

If you want full JSONPath support (filters, unions, slices), add:

```jsonc
// package.json (additions)
{
  "dependencies": {
    "jsonpath-plus": "^10.0.0"
  }
}
```

The adapter will use it automatically; otherwise the fallback subset is used.

---

## Acceptance Criteria

- Selecting an edge opens **Mapper Drawer**. Users can add/remove/edit mapping rows.  
- Live preview shows **Upstream** (source sample) and **Result** (apply mappings).  
- Transform actions: `to_number`, `clamp`, `wrap_array`, `pick`, `merge`, `to_string`, `to_boolean`, `parse_date`, `regex_replace`.  
- Validators: `required`, `min`, `max`, `regex`, `enum`.  
- **Reducer** support: `reduce: "list_concat"` concats arrays into a single target field.  
- Persisting mappings updates the IR edge (`edge.mappings`).  
- Unit tests cover mapping pipelines, JSONPath, and drawer basics. **≥80%** coverage.

---

## How to Review & Test Locally

```bash
pnpm i
pnpm test
# In UI:
# 1) Build two nodes and connect an edge.
# 2) Open Mapper Drawer for that edge.
# 3) Add mapping: $.form.values.concurrency -> concurrency (to_number + clamp).
# 4) Save and re-open to verify persistence.
```

---

## Follow‑ups

- **PR‑AB‑005:** Parallel (Items) telemetry hooks for inflight/completed math.  
- **PR‑AB‑006:** Parallel (Branches) broadcast UX and Combiner Agent schema picker.  
- **PR‑AB‑008:** Exporter consumes saved mappings to build the engine request envelope.
