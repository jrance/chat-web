import type { AnyToolConfig } from "../types";
import { ddgsParamsSchema } from "../schemas/ddgs.schema";

const DEFAULTS = ddgsParamsSchema.parse({});
const REGION_CODES = ["us-en", "uk-en", "wt-wt", "de-de", "fr-fr", "es-es", "it-it", "nl-nl", "in-en", "jp-jp"] as const;
const LEGACY_REGION_MAP: Record<string, string> = { us: "us-en", eu: "wt-wt" };
const VALID_REGIONS = new Set<string>(REGION_CODES);

const clampResults = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULTS.maxResults;
  const rounded = Math.floor(value);
  if (rounded < 1) return 1;
  if (rounded > 50) return 50;
  return rounded;
};

const coerceRegion = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (VALID_REGIONS.has(trimmed)) return trimmed;
    const normalized = trimmed.toLowerCase();
    if (VALID_REGIONS.has(normalized)) return normalized;
    const mapped = LEGACY_REGION_MAP[normalized];
    if (mapped) return mapped;
  }
  return DEFAULTS.region;
};

const coerceStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return filtered.length ? filtered : fallback;
};

export function migrateWebSearchToDdgs<T extends AnyToolConfig>(tool: T): T | AnyToolConfig {
  if (!tool || tool.id !== "tool:web-search") return tool;

  const params = (tool.parameters || {}) as Record<string, unknown>;

  const migrated: AnyToolConfig = {
    ...tool,
    id: "tool:ddgs.search",
    name: "DuckDuckGo Search",
    version: "0.1.0",
    auth: { type: "none" },
    transport: { kind: "engine", toolId: "tool:ddgs.search" },
    parameters: {
      query: typeof params.query === "string" ? params.query : DEFAULTS.query,
      vertical: "web",
      maxResults: clampResults(params.topK),
      safesearch: DEFAULTS.safesearch,
      region: coerceRegion(params.region),
      timeLimit: DEFAULTS.timeLimit,
      siteFilter: coerceStringArray(params.siteFilter, DEFAULTS.siteFilter),
      mustInclude: coerceStringArray(params.mustInclude, DEFAULTS.mustInclude),
    },
  };

  return migrated;
}
