
# PROMPT FOR CODEX

Implement the following **UI PR** and validate that everything has been completed fully and that all acceptance criteria are met. You may improve on the suggested code if there is a cleaner approach.

---

# UI-PR-07 — Replace "Web Search" tool definition with DDGS (DuckDuckGo Search)

## Description
Switch the existing generic “Web Search” tool to a DDGS-backed definition that matches the real inputs the orchestration engine will support. This keeps the UI schema aligned with the engine tool and removes the need for API keys for demos. The tool will power a News Agent and a Wikipedia Agent (both will point to the same tool, differing by default parameters).

> Note: This PR only changes the UI tool definition & validation schema. A separate Engine PR will add the server-side `tool:ddgs.search` implementation.

## Purpose
- Provide a keyless, OSS-friendly search tool for demos.
- Model the ddgs parameters explicitly in the UI (vertical, region, timelimit, safesearch, etc.).
- Prepare the Agent Builder to attach this tool to agents (e.g., “News Agent” with `vertical=news`, “Wikipedia Agent” with `vertical=wikipedia`).

## Scope
- Update tool catalog entry to `tool:ddgs.search` with accurate parameters.
- Add a zod schema (or your current validation mechanism) for strong typing in the inspector.
- Provide migration logic from the old tool config (`region`, `topK`) to the new fields.
- Unit tests for the tool schema & migration.
- No engine changes in this PR.

## Files to Add/Change
src/features/tools/catalog.ts
src/features/tools/schemas/ddgs.schema.ts
src/features/tools/migrations/007_ddgs_migrate.ts
src/features/test-panel/__tests__/ddgs.schema.test.ts
docs/tools/DDGS.md

## Tool Definition (drop-in replacement)
Replace the old object with the following (adjust import/export style to your codebase):

```ts
export const DDGS_TOOL_DEF = {
  id: "tool:ddgs.search",
  name: "DuckDuckGo Search",
  version: "0.1.0",
  category: "search",
  auth: { type: "none" },
  // Engine executes the tool; no external HTTP transport from the UI.
  transport: { kind: "engine", toolId: "tool:ddgs.search" },
  parameters: [
    { name: "query", type: "string", description: "Search query", scope: "AgentOverride", default: "" },

    // Which DDG vertical to use.
    { name: "vertical", type: "enum", enum: ["web", "news", "wikipedia"], default: "web", scope: "AgentOverride",
      description: "Search vertical. 'wikipedia' is implemented via site:wikipedia.org filter on web." },

    // Maximum results to return from the engine (ddgs max_results).
    { name: "maxResults", type: "number", default: 5, min: 1, max: 50, scope: "AgentOverride",
      description: "Maximum number of results to return." },

    // DuckDuckGo safe search mode
    { name: "safesearch", type: "enum", enum: ["off", "moderate", "strict"], default: "moderate", scope: "AgentOverride",
      description: "Content filtering level." },

    // DDG 'region' parameter (e.g. 'us-en', 'uk-en', 'wt-wt' (worldwide))
    { name: "region", type: "enum",
      enum: ["us-en","uk-en","wt-wt","de-de","fr-fr","es-es","it-it","nl-nl","in-en","jp-jp"],
      default: "us-en", scope: "OrgLocked",
      description: "Region/language targeting (DDG region code)." },

    // Freshness window (ddgs timelimit: 'd' (day), 'w' (week), 'm' (month), 'y' (year)). Empty = no limit.
    { name: "timeLimit", type: "enum", enum: ["", "d","w","m","y"], default: "", scope: "AgentOverride",
      description: "Freshness filter: d=day, w=week, m=month, y=year; empty means no limit." },

    // Optional domain filter(s). Implemented via query rewrite: `site:host1 OR site:host2`
    { name: "siteFilter", type: "string[]", default: [], scope: "AgentOverride",
      description: "Restrict search to these hostnames (e.g., ['reuters.com','apnews.com'])." },

    // Optional: light client-side post-filter of returned snippets before agent sees them.
    { name: "mustInclude", type: "string[]", default: [], scope: "AgentOverride",
      description: "Discard results that do not include these terms in title/snippet." }
  ],
  status: "active",
  description: "Free, keyless search via DuckDuckGo (ddgs). Supports web, news, and Wikipedia-only queries."
} as const;
```

### Catalog wiring
In `src/features/tools/catalog.ts`, export the new definition and remove the legacy `tool:web-search` entry. Ensure the toolbox panel uses the new definition ID.

```ts
import { DDGS_TOOL_DEF } from "./schemas/ddgs.schema";
// ...
export const TOOL_CATALOG = [
  // ...other tools
  DDGS_TOOL_DEF,
];
```

## Validation Schema (zod example)
```ts
// src/features/tools/schemas/ddgs.schema.ts
import { z } from "zod";

export const ddgsParamsSchema = z.object({
  query: z.string().default(""),
  vertical: z.enum(["web","news","wikipedia"]).default("web"),
  maxResults: z.number().int().min(1).max(50).default(5),
  safesearch: z.enum(["off","moderate","strict"]).default("moderate"),
  region: z.enum(["us-en","uk-en","wt-wt","de-de","fr-fr","es-es","it-it","nl-nl","in-en","jp-jp"]).default("us-en"),
  timeLimit: z.enum(["","d","w","m","y"]).default(""),
  siteFilter: z.array(z.string()).default([]),
  mustInclude: z.array(z.string()).default([]),
});
export type DdgsParams = z.infer<typeof ddgsParamsSchema>;

export { DDGS_TOOL_DEF } from "../catalog"; // or export together where appropriate
```

## Migration (from legacy `tool:web-search`)
```ts
// src/features/tools/migrations/007_ddgs_migrate.ts
import type { AnyToolConfig } from "../types";

export function migrateWebSearchToDdgs(tool: AnyToolConfig): AnyToolConfig {
  if (tool.id !== "tool:web-search") return tool;
  const regionMap: Record<string,string> = { us: "us-en", eu: "wt-wt" };
  const maxResults = typeof tool.parameters?.topK === "number" ? tool.parameters.topK : 5;

  return {
    ...tool,
    id: "tool:ddgs.search",
    name: "DuckDuckGo Search",
    auth: { type: "none" },
    transport: { kind: "engine", toolId: "tool:ddgs.search" },
    parameters: {
      query: tool.parameters?.query ?? "",
      vertical: "web",
      maxResults,
      safesearch: "moderate",
      region: regionMap[tool.parameters?.region ?? "us"] ?? "us-en",
      timeLimit: "", siteFilter: [], mustInclude: []
    }
  };
}
```

## Tests
- `ddgs.schema.test.ts`
  - validates defaults and boundary constraints (maxResults range, enums).
  - snapshot of the catalog entry to catch accidental drift.
- `007_ddgs_migrate.test.ts`
  - converts a legacy object and asserts the mapped fields (region/topK).

## Docs
- `docs/tools/DDGS.md`
  - Parameter reference & examples:
    - News Agent defaults: `vertical=news`, `timeLimit='d'`, `siteFilter=['reuters.com','apnews.com','bbc.com']`
    - Wikipedia Agent defaults: `vertical='wikipedia'`
  - Notes on region codes and timelimit semantics.
  - How the engine uses these params (at a glance).

## Acceptance Criteria
- The toolbox shows “DuckDuckGo Search” with the parameters above.
- Validation prevents invalid combos and enforces `maxResults` range.
- Old “Web Search” configs auto-migrate (region & topK mapped).
- Inspector UX: `siteFilter` renders as a tag list control; enums as selects.
- Unit tests pass.

## Manual Validation
1. Add the tool to a News Agent with `vertical=news`, `timeLimit='d'`, `siteFilter=['reuters.com','apnews.com','bbc.com']`.
2. Add the tool to a Wikipedia Agent with `vertical='wikipedia'`.
3. Export the orchestration package and confirm the tool node shows the new ID and parameters.

---

## React SPA Tenets (append to every UI PR)
- Type-safe & explicit: strong typing (zod/TS) for all tool parameters.
- Minimal deps: add dependencies only if they deliver clear value.
- Clean state & unmount safety: cancel in-flight effects; guard against race conditions.
- Accessible by default: keyboard reachable, ARIA labels for new controls.
- Tested & deterministic: unit tests for schemas, migrations, and important UX states.
- No secrets in UI: do not store or display credentials; ddgs uses `auth: none`.
