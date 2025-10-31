
# PROMPT FOR CODEX

Implement the following **Front‑End PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI‑PR02 — Widget Host + Registry (render structured responses)

## Summary
Introduce a **Widget Host** and **Registry** so the Test panel can render rich, structured responses alongside streamed text. The server can tag events with a `ui` envelope (`{ kind, version?, props? }`), and the client turns those into mounted React widgets. Unknown widgets gracefully fall back to plaintext/markdown.

This builds on **UI‑PR01** (streaming) and prepares for **structuredOutput** and future ChatKit widgets.

> Scope: registry, host, initial widgets (`citation-list`, `tool-result`, `key-value`, `table`, `code`, `error`). Minimal changes to the existing hook to plumb `evt.ui` into messages.

---

## Purpose
- Decouple *how* the engine wants content rendered from the chat UI implementation.
- Allow incremental/streaming updates to a widget's `props` while tokens arrive.
- Make it trivial to add enterprise‑specific widgets (register once, render anywhere).

---

## Goals
- Add a **typed registry**: `registerWidget(kind, component, options?)`.
- Add a **WidgetHost** that accepts an array of `WidgetEnvelope` and renders them in order.
- Update `useResponsesStream` to merge any `evt.ui` envelopes onto the **current assistant message** during streaming.
- Provide **initial widgets** with simple, readable, dependency‑light implementations.
- Keep everything **safe by default** (no raw HTML injection).

---

## Files to Add / Change

```
src/
  lib/
    widgets/
      registry.ts                # global registry + types + helpers
      host.tsx                   # <WidgetHost envelopes=[...] />
      merge.ts                   # envelope merge helpers (stable by kind/id)
      builtin/
        CitationList.tsx
        ToolResult.tsx
        KeyValuePairs.tsx
        SimpleTable.tsx
        CodeBlock.tsx
        ErrorCallout.tsx
  features/
    test-panel/
      components/
        TestChatMessage.tsx      # renders a ChatMessage with text + <WidgetHost/>
      hooks/
        useResponsesStream.ts    # (changed) push evt.ui into message.widgets
__tests__/
  widgets.registry.spec.ts
  widgets.merge.spec.ts
  widgethost.render.spec.tsx
```

> Adjust paths to match your repo layout; keep `lib/widgets` independent of the builder UI.

---

## Implementation

### 1) Types & Registry (`src/lib/widgets/registry.ts`)

```ts
import { ReactNode } from "react";

export type WidgetEnvelope = {
  kind: string;
  id?: string;                  // optional stable id to support fine‑grained merges
  version?: string;
  props?: Record<string, any>;
};

export type WidgetComponentProps = {
  props?: Record<string, any>;
};

export type WidgetComponent = (p: WidgetComponentProps) => ReactNode;

export type WidgetRegistration = {
  component: WidgetComponent;
  fallback?: boolean;           // mark a safe default fallback
};

const REGISTRY = new Map<string, WidgetRegistration>();

export function registerWidget(kind: string, component: WidgetComponent, opts?: { fallback?: boolean }) {
  REGISTRY.set(kind, { component, fallback: !!opts?.fallback });
}

export function getWidget(kind: string): WidgetRegistration | undefined {
  return REGISTRY.get(kind);
}

export function listWidgets(): string[] {
  return Array.from(REGISTRY.keys());
}

// Default fallback (plain text renderer can attach here later if desired)
export function getFallback(): WidgetRegistration | undefined {
  for (const [, reg] of REGISTRY) if (reg.fallback) return reg;
  return undefined;
}
```

### 2) Envelope merge helpers (`src/lib/widgets/merge.ts`)

```ts
import { WidgetEnvelope } from "./registry";

// Merge new envelopes into existing array (by kind+id). Shallow‑merge props.
export function mergeEnvelopes(existing: WidgetEnvelope[], incoming?: WidgetEnvelope | WidgetEnvelope[]): WidgetEnvelope[] {
  if (!incoming) return existing;
  const arr = Array.isArray(incoming) ? incoming : [incoming];
  const out = [...existing];
  for (const env of arr) {
    const key = env.id ? `${env.kind}:${env.id}` : `${env.kind}`;
    const idx = out.findIndex(e => (e.id ? `${e.kind}:${e.id}` : e.kind) === key);
    if (idx === -1) out.push(env);
    else out[idx] = { ...out[idx], ...env, props: { ...(out[idx].props||{}), ...(env.props||{}) } };
  }
  return out;
}
```

### 3) Widget Host (`src/lib/widgets/host.tsx`)

```tsx
import React from "react";
import { WidgetEnvelope, getWidget, getFallback } from "./registry";

type Props = { envelopes?: WidgetEnvelope[] };

export function WidgetHost({ envelopes = [] }: Props) {
  if (!envelopes.length) return null;
  return (
    <div className="space-y-2">
      {envelopes.map((env, i) => {
        const reg = getWidget(env.kind) || getFallback();
        if (!reg) return null;
        const Comp: any = reg.component;
        return (
          <div key={env.id ?? `${env.kind}-${i}`} className="w-full">
            <Comp props={env.props} />
          </div>
        );
      })}
    </div>
  );
}
```

### 4) Built‑in widgets (minimal, safe)

`src/lib/widgets/builtin/CitationList.tsx`
```tsx
export default function CitationList({ props }: { props?: any }) {
  const items = Array.isArray(props?.items) ? props.items : [];
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="text-xs uppercase opacity-70 mb-2">Citations</div>
      <ul className="space-y-2">
        {items.map((c: any, idx: number) => (
          <li key={idx} className="text-sm">
            <a href={c.url} target="_blank" rel="noreferrer" className="underline">
              {c.title || c.url}
            </a>
            {c.snippet && <div className="opacity-80 text-xs mt-1">{c.snippet}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/lib/widgets/builtin/ToolResult.tsx`
```tsx
export default function ToolResult({ props }: { props?: any }) {
  const name = props?.name ?? "tool";
  const summary = props?.summary;
  const details = props?.details;
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="text-xs uppercase opacity-70 mb-2">Tool Result: {name}</div>
      {summary && <div className="text-sm mb-2">{summary}</div>}
      {details && <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(details, null, 2)}</pre>}
    </div>
  );
}
```

`src/lib/widgets/builtin/KeyValuePairs.tsx`
```tsx
export default function KeyValuePairs({ props }: { props?: any }) {
  const entries: Array<{key:string, value:any}> = props?.entries || [];
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="grid grid-cols-3 gap-2 text-sm">
        {entries.map((kv, i) => (
          <React.Fragment key={i}>
            <div className="opacity-70">{kv.key}</div>
            <div className="col-span-2">{String(kv.value)}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

`src/lib/widgets/builtin/SimpleTable.tsx`
```tsx
export default function SimpleTable({ props }: { props?: any }) {
  const cols: string[] = props?.columns || [];
  const rows: any[][] = props?.rows || [];
  return (
    <div className="rounded-xl border border-neutral-800 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900/60">
          <tr>{cols.map((c, i) => <th key={i} className="text-left px-3 py-2">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-800">
              {r.map((cell, j) => <td key={j} className="px-3 py-2">{String(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`src/lib/widgets/builtin/CodeBlock.tsx`
```tsx
export default function CodeBlock({ props }: { props?: any }) {
  const lang = props?.language ?? "text";
  const code = props?.content ?? "";
  return (
    <pre className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/70 text-xs overflow-auto">
      {/* No HTML rendering; safe plain text */}
      {code}
    </pre>
  );
}
```

`src/lib/widgets/builtin/ErrorCallout.tsx`
```tsx
export default function ErrorCallout({ props }: { props?: any }) {
  return (
    <div className="rounded-xl border border-red-800 p-3 bg-red-950/40 text-red-200">
      <div className="text-xs uppercase opacity-80 mb-1">Error</div>
      <div className="text-sm">{props?.title || "An error occurred."}</div>
      {props?.details && <pre className="mt-2 text-xs opacity-90 overflow-auto">{JSON.stringify(props.details, null, 2)}</pre>}
    </div>
  );
}
```

### 5) Register built‑ins (in `src/lib/widgets/registry.ts` or a new `index.ts`)

```ts
import { registerWidget } from "./registry";
import CitationList from "./builtin/CitationList";
import ToolResult from "./builtin/ToolResult";
import KeyValuePairs from "./builtin/KeyValuePairs";
import SimpleTable from "./builtin/SimpleTable";
import CodeBlock from "./builtin/CodeBlock";
import ErrorCallout from "./builtin/ErrorCallout";

export function registerBuiltins() {
  registerWidget("citation-list", CitationList);
  registerWidget("tool-result", ToolResult);
  registerWidget("key-value", KeyValuePairs);
  registerWidget("table", SimpleTable);
  registerWidget("code", CodeBlock);
  registerWidget("error", ErrorCallout, { fallback: true }); // safe default
}
```

Call `registerBuiltins()` once in your app bootstrap (e.g., `main.tsx`).

### 6) Update the hook to accept envelopes (change in `useResponsesStream.ts`)

Add at top:
```ts
import { mergeEnvelopes } from "../../../lib/widgets/merge";
```

In the `response.output_text.delta` case (and optionally others that can carry `ui`), merge into the **current assistant** message:

```ts
case "response.output_text.delta":
  setMessages(prev => {
    const last = prev[prev.length - 1];
    const isAssistant = last && last.role === "assistant" && !last.done;
    const text = (last?.text || "") + (evt.delta || "");
    if (!isAssistant) {
      return [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        time: Date.now(),
        done: false,
        widgets: evt.ui ? [evt.ui] : []
      }];
    }
    const next = [...prev];
    next[next.length - 1] = {
      ...last,
      text,
      widgets: mergeEnvelopes(last.widgets || [], evt.ui)
    };
    return next;
  });
  break;
```

(Optionally handle `evt.ui` on other event types the engine emits.)

### 7) Test Chat message component (`src/features/test-panel/components/TestChatMessage.tsx`)

```tsx
import { WidgetHost } from "../../../lib/widgets/host";
import { ChatMessage } from "../../../lib/orch/types";

export default function TestChatMessage({ m }: { m: ChatMessage }) {
  return (
    <div className={m.role === "user" ? "text-right" : "text-left"}>
      <div className="inline-block max-w-[70%] rounded-lg px-3 py-2"
           style={{ background: m.role === "user" ? "#2f3140" : "#1e1f2b" }}>
        {m.text}
        {m.widgets && m.widgets.length > 0 && (
          <div className="mt-2">
            <WidgetHost envelopes={m.widgets} />
          </div>
        )}
        {m.role === "tool" && m.tool && (
          <div className="mt-2">
            <WidgetHost envelopes={[{ kind: "tool-result", props: { name: m.tool.name, details: m.tool.result } }]} />
          </div>
        )}
      </div>
    </div>
  );
}
```

Use this in your Test panel list instead of inlining message rendering.

---

## Acceptance Criteria
- Widgets can be streamed incrementally: repeated `evt.ui` updates merge into the existing widget’s `props` without flicker.
- Unknown `ui.kind` falls back to the **fallback widget** safely (no raw HTML).
- Built‑ins render correctly:
  - `citation-list` shows title/url/snippet list.
  - `tool-result` shows summarized + raw JSON.
  - `key-value`, `table`, `code`, `error` render as expected.
- Hook updates: when the server sends `ui` on deltas, widgets appear on the **current assistant** message.
- No additional heavy runtime deps were introduced.

---

## Validation (manual)
1) Start the engine and run a prompt that streams both text and a `ui` envelope (e.g., `citation-list`).  
2) Confirm the widget appears and updates as the stream progresses.  
3) Trigger a tool call and verify a tool result card is rendered (from tool message or via `evt.ui`).  
4) Disconnect/reconnect; ensure no double‑renders or registry duplication.

---

## Tests
- `widgets.registry.spec.ts`: register/unregister lookups; fallback behavior.  
- `widgets.merge.spec.ts`: merge semantics for (kind) and (kind+id).  
- `widgethost.render.spec.tsx`: render known + unknown widgets; snapshot basic output.  
- Update `useResponsesStream.spec.ts`: assert that `evt.ui` results in `message.widgets` being present and merged.

---

## React SPA Tenets (Append to every UI PR)
- **Clarity first:** small focused components; explicit props; no hidden globals.  
- **Types everywhere:** strict TypeScript; no `any` in public interfaces.  
- **Async correctness:** cancel on unmount; debounced renders for bursty deltas.  
- **Minimal deps:** platform APIs; keep bundle lean; no raw HTML renderers by default.  
- **Performance:** batch state updates; virtualize chat list; avoid registry re‑creation.  
- **Security:** never inject unsanitized HTML; clamp widget sizes; validate `props` shapes defensively.  
- **A11y:** semantic roles, keyboard navigation, focus management.  
- **Config:** env/props for API base, tenant, headers; no hard‑coded tokens.  
- **Errors:** widgets must fail closed (render nothing or an error callout).  
- **Tests:** deterministic; no network; cover registry + merge + host.  
- **Extensibility:** registry map, simple envelope contract; enterprise widgets drop in with 1‑line registration.
