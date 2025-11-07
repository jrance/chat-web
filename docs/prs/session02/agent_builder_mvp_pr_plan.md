
# Agent Builder MVP — PR Plan (Feature: `codex-collab`)

> Repository: `jrance/chat-web` • Module: `src/modules/agent-builder` • IR: `src/modules/agent-builder/model/ir.ts`  
> Goal: Ship a **lean, expandable** Agent Builder MVP that supports (1) XLSX fan‑out/validate orchestration and (2) RAG-style multi‑agent graphs (Policy/News/M365) with **typed ports**, a **Data Mapper**, and two flavors of **Parallel** (Items mode & Branches mode).  
> Coverage: **≥80%** for all new code (Vitest + React Testing Library).

---

## Scope recap (MVP features)

1. **Unified Entry (Chat/Form + File)** — one entry node that can take chat text, structured form values, and file uploads (uploads become `file_id` handles).
2. **Agent node (LLM)** — single-turn LLM agent with `allowed_tools` whitelist and optional structured output.
3. **Sequential** — run children in order; pass state along.
4. **Router (LLM)** — simple supervisor that chooses a target child (returns `{ target, confidence }`).
5. **Parallel — Items mode** — bounded-concurrency dispatcher over `array<T>` (fan‑out to a worker Agent; fan‑in via Reducer).
6. **Parallel — Branches mode** — run fixed child agents **concurrently** with shared `messages/context` (e.g., SharePoint Agent + OneDrive Agent).
7. **Reducer / Combiner** — aggregations (`list_concat` MVP) to produce final `results` / `evidence` arrays.
8. **Publisher** — push finished artifact (e.g., CSV/XLSX) to SharePoint and return URL.
9. **Data Mapper (Edges)** — typed source→target wiring with JSONPath, transforms, defaults, validators.
10. **Tool Registry (Schemas)** — deterministic tools with JSON Schemas for args/output; attach to Agent by whitelist.
11. **Exporter** — compile a canvas into an engine request envelope (`user_input[]` supports text/form/files), SSE-ready.
12. **Telemetry panel** — subscribe to SSE (`response.*`) and display per-node progress (inflight, completed, branch tags).

---

## Tenets (apply to **every** PR)

1. **Spec-first & Typed**  
   - Strong TypeScript types for IR, Nodes, Ports, Tools, Edge Mappings, Transforms.  
   - JSON Schema alongside TS types where user input is persisted/exported.  
   - Version the IR (`ir.version = "0.3"` MVP) and provide a migration utility.

2. **Codeless by Design**  
   - Users never write code; **Data Mapper** provides JSONPath pickers, transforms, defaults, and validators with live preview.  
   - Nodes expose **typed ports** with clear shapes to enable autowiring and guardrails.

3. **Composability & Reuse**  
   - Two **Parallel** modes (Items vs Branches) implemented as one component with `mode` prop.  
   - Save/load **templates** (e.g., News Agent, Policy Single/Sequential, M365 SP/OD branches).

4. **Determinism & Observability**  
   - Deterministic tools are first‑class; Agents declare `allowed_tools`.  
   - Emit clear telemetry events; show inflight/completed, branch tags, and reducer stats.

5. **Performance & UX**  
   - Bounded concurrency in Items mode; token‑bounded chat history to children in Branches mode.  
   - Accessibility (ARIA) and keyboard navigation for the canvas and dialogs.

6. **Quality Bar**  
   - **≥80%** test coverage per PR; unit tests for logic, component tests for UI, and light integration tests.  
   - No `any`; exhaustive switch on discriminated unions; strict TypeScript config.

---

## Planned PRs

### PR‑AB‑001 — IR v0.3: Nodes, Ports, Edges, Transforms
**Why:** Establish a stable, typed IR that can represent both XLSX fan‑out and RAG branch‑fan‑out.

**Changes**
- `model/ir.ts`
  - Add `IRVersion = "0.3"` and `GraphDoc` root with metadata.
  - `NodeKind` union: `entry.form`, `agent`, `sequential`, `router.llm`, `parallel.items`, `parallel.branches`, `reducer`, `publisher`.
  - `PortSchema` (type, shape, reducer?). `InputPort`, `OutputPort` with `jsonSchema?` and `example?`.
  - `EdgeMapping`: `{ from: JSONPath; to: string; transforms?: Transform[]; default?: any; validators?: Validator[]; reduce?: "list_concat" }`.
  - `Transform` union: `to_number`, `clamp`, `wrap_array`, `pick`, `merge`, `map`, `filter`, `join`, `regex_replace`, `to_string`, `to_boolean`, `parse_date` (implement MVP subset).
  - `Validator` union: `required`, `min`, `max`, `regex`, `enum`.
- `model/migrate.ts` — v0.2 → v0.3 migration (noop passthrough where possible).
- `model/validate.ts` — Zod/Valibot validation of IR docs (dev only).

**Tests**
- IR type-level tests (tsd/expect-type) + runtime validation of sample graphs.  
- Migration tests: legacy docs → v0.3 produce same shape.

**Acceptance**
- Can express: (1) XLSX fan‑out graph, (2) Branch fan‑out SP/OD RAG graph, (3) Simple Policy/News agents.

---

### PR‑AB‑002 — Unified Entry (Chat/Form/File)
**Why:** Collapse File Upload into Chat/Form; treat files as `file_id` handles.

**Changes**
- `components/EntryForm.tsx` — dynamic form renderer w/ field types: `text`, `textarea`, `number`, `select`, `checkbox`, `datetime`, `file` (supports multiple; `accept`, `maxSizeMB`).
- `lib/uploads.ts` — gateway upload helper: returns `{ file_id, mime_type, display_name, size }`.
- Update canvas to allow a single `entry.form` node; deprecate `entry.file` if present via migration.
- IR: `EntryOutputs = { messages?: MessagePart[]; form: { values: object }; files?: FileRef[] }`.

**Tests**
- Component tests: upload flows (happy/invalid mime/size).
- Mapper suggestion: when a downstream port expects `file_ref`, suggest `form.values.<field>.file_id`.

**Acceptance**
- XLSX scenario: form field `uploaded_file` mapped to `xlsx.parse.file_ref` without writing code.

---

### PR‑AB‑003 — Node Palette & Canvas for MVP Kinds
**Why:** Let users drag/drop the minimal set and wire them visually.

**Changes**
- `components/NodePalette.tsx` — palette entries for all MVP kinds with icon + short help.
- `components/BuilderCanvas.tsx` — add rendering for new node kinds and typed ports (in/out badges).  
- `components/NodeCard/*` — small cards per kind with key controls:
  - `agent`: tools whitelist, structure selector (text/JSON), history window.
  - `router.llm`: branch options.
  - `parallel.items`: `concurrency` knob + live inflight/completed.
  - `parallel.branches`: children list + “broadcast” checkboxes for `messages/context`.
  - `reducer`: reducer strategy (`list_concat` MVP).
  - `publisher`: destination config (SharePoint URL/path text only for MVP).

**Tests**
- Canvas render snapshot + interactive tests for adding nodes and connecting simple edges.

**Acceptance**
- A user can assemble the XLSX and SP/OD RAG graphs using only these nodes.

---

### PR‑AB‑004 — Data Mapper (Edges) + Mapping Engine
**Why:** Codeless wiring with JSONPath, transforms, defaults, validators.

**Changes**
- `components/MapperDrawer.tsx` — side drawer that opens when an edge is selected.  
  - Source selector (Upstream outputs vs Global state).  
  - JSONPath picker with live preview.  
  - Transform pipeline builder with composable chips (MVP: `to_number`, `clamp`, `wrap_array`, `merge`, `pick`).  
  - Defaults + validators UI.
- `lib/mapper.ts` — pure mapping engine (no DOM), evaluates mapping spec; returns `{ ok, value, errors[] }`.

**Tests**
- Unit tests for `lib/mapper.ts` covering transform composition and validator failures.  
- Component tests for the drawer interactions.

**Acceptance**
- Can map:  
  - `form.values.concurrency` → `parallel.items.concurrency` with `to_number+clamp`.  
  - `row_agent.output` → `reducer.results` with `wrap_array + reduce=list_concat`.  
  - Broadcast `messages/context` to branches with `merge` per child.

---

### PR‑AB‑005 — Parallel (Items) with Concurrency UI
**Why:** XLSX fan‑out needs bounded concurrency & telemetry.

**Changes**
- `nodes/ParallelItems.tsx` — shows `concurrency`, `inflight`, `completed`.  
- `lib/simulate.ts` — mock simulator for planner math (`inflight = dispatched - completed`).  
- `telemetry/types.ts` — define events used by UI (e.g., `planner.cap/inflight`, `worker.done`).

**Tests**
- Simulation math tests; component renders; state transitions.

**Acceptance**
- With sample rows (e.g., 37) and `concurrency=8`, UI reflects the steady‑state top‑up behavior.

---

### PR‑AB‑006 — Parallel (Branches) + Combiner Agent
**Why:** RAG branch fan‑out (SharePoint + OneDrive) and LLM synthesis.

**Changes**
- `nodes/ParallelBranches.tsx` — configure fixed children, broadcast fields, and per-child overrides (e.g., `{ connector: "sharepoint" }`).  
- `nodes/AgentCombiner.tsx` — an `agent` configured as “synthesizer” with structured output schema (e.g., `Synthesis@1`).

**Tests**
- Branch broadcast mapping tests; combiner schema validation.

**Acceptance**
- User can wire SP & OD agents in parallel and synthesize a merged answer/citations object.

---

### PR‑AB‑007 — Tool Registry + Tool Picker
**Why:** Deterministic tools as first‑class, with schemas & agent whitelists.

**Changes**
- `model/tools.ts` — registry with MVP tools and JSON Schemas:  
  - `xlsx.parse`, `report.build_csv`, `s3.list`, `s3.get_text`, `policy.search`, `news.search`, `sharepoint.upload`.
- `components/ToolPicker.tsx` — select `allowed_tools` on an Agent and view tool IO schema.
- `lib/schema.ts` — helpers to pretty-print schemas and validate sample args.

**Tests**
- Registry snapshot & schema guards; picker interactions.

**Acceptance**
- Agent can constrain tools; Mapper suggests compatible sources for tool args.

---

### PR‑AB‑008 — Exporter to Engine Request
**Why:** Produce a single engine-ready JSON envelope (OpenAI‑ish).

**Changes**
- `lib/exporter.ts` — compile current graph → `{ model, orchestration, user_input: [text|form|files], stream }`.  
- `lib/validate-export.ts` — schema to guard exported shape.  
- `components/ExportPanel.tsx` — show JSON preview + “Copy” and “Send” (behind feature flag).

**Tests**
- Export samples for XLSX and RAG graphs; validate against schema; golden snapshots.

**Acceptance**
- Export matches the agreed `user_input[]` shape and includes file `file_id` handles.

---

### PR‑AB‑009 — Telemetry Panel (SSE viewer)
**Why:** Inspect planner decisions, branch progress, and reducer stats live.

**Changes**
- `components/TelemetryPanel.tsx` — subscribe to SSE and group by node; show `events[]` stream.  
- `lib/sse.mock.ts` — mock EventSource for tests.

**Tests**
- SSE parsing; UI rendering with synthetic `response.*` events.

**Acceptance**
- Users see `planner: inflight/capacity` lines and branch tags in real time.

---

### PR‑AB‑010 — Templates & Presets (MVP)
**Why:** One-click creation of common graphs.

**Changes**
- `templates/*.json` — News Agent, Policy Single Agent, Policy Sequential, M365 SP/OD Branches, XLSX Fan‑out Validation.  
- `components/TemplateGallery.tsx` — create-from-template dialog; fills the canvas & opens Mapper suggestions.

**Tests**
- Snapshot tests that the templates load and validate under IR v0.3.

**Acceptance**
- Non‑experts can start from working graphs in 1 click.

---

## Testing & Quality

- **Unit:** `lib/*` (mapper, exporter, simulate) — deterministic tests.  
- **Component:** `components/*` — React Testing Library for interactions.  
- **Integration (light):** load a template, tweak a mapping, export JSON — ensure output schema passes.  
- **Coverage:** enforce 80% line/branch coverage via Vitest config and CI.

---

## Developer Experience

- Strict TS (`"strict": true`), ESLint + Prettier.  
- Storybook optional (later); for MVP, add `playroom`-style fixtures for nodes.  
- Feature flags for Telemetry/Export until backend URLs are ready.

---

## Validation Checklist (MVP “Done”)

- [ ] Build the **XLSX** flow: Entry(form+file) → xlsx.parse → Parallel(Items) → Worker Agent → Reducer → Publisher.  
- [ ] Build the **RAG SP/OD** flow: Entry(chat/form) → Parallel(Branches) → SP Agent & OD Agent → Combiner Agent → (Publisher optional).  
- [ ] Export both graphs to JSON envelope; schemas validate; test coverage ≥80%.  
- [ ] Telemetry panel renders mocked SSE and groups events by node.

---

## Appendix — Minimal Schemas

**FileRef**
```ts
type FileRef = { file_id: string; mime_type: string; display_name: string; size?: number };
```

**Synthesis@1 (Combiner output)**
```ts
type Synthesis = {
  answer: string;
  citations: string[];        // URIs
  merged_sources?: string[];  // URIs
  confidence?: number;
};
```

**RowResult (Worker output, XLSX)** *(illustrative)*
```ts
type RowResult = {
  rowIndex: number;
  status: "ok" | "mismatch" | "missing-evidence" | "error";
  reasons?: string[];
  evidence?: { uri: string; snippet?: string }[];
};
```

---

### Notes
- Raw file inspection via this environment was limited (GitHub blob pages failed to render reliably). This plan targets the known paths and aligns with the canvases you shared; we’ll adjust field names to match `ir.ts` during PR‑AB‑001.
