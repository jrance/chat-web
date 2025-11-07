import type { EdgeMapping, Transform, Validator } from "../model/ir";
import { evalJsonPath } from "./jsonpath";

export type MapError = { kind: "jsonpath" | "transform" | "validator"; message: string };
export type MapResult<T = unknown> = { ok: true; value: T } | { ok: false; errors: MapError[] };

export function runJsonPath(source: unknown, jsonPath: string): MapResult<unknown> {
  try {
    const hits = evalJsonPath(source, jsonPath);
    if (!hits.length) {
      return { ok: true, value: undefined };
    }
    return { ok: true, value: hits.length === 1 ? hits[0] : hits };
  } catch (error: any) {
    return { ok: false, errors: [{ kind: "jsonpath", message: error?.message ?? "JSONPath failed" }] };
  }
}

/** ---------- Transforms ---------- */

function t_to_number(value: unknown): unknown {
  if (value == null || value === "") {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function t_clamp(value: unknown, min?: number, max?: number): unknown {
  if (typeof value !== "number") {
    return value;
  }
  if (min != null && value < min) {
    return min;
  }
  if (max != null && value > max) {
    return max;
  }
  return value;
}

function t_wrap_array(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function t_pick(value: unknown, paths: string[]): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const hits = evalJsonPath(value, path);
    out[path] = hits.length === 1 ? hits[0] : hits;
  }
  return out;
}

function t_merge(value: unknown, obj: Record<string, unknown>): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>), ...obj };
  }
  return { ...obj, value };
}

function t_to_string(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function t_to_boolean(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return Boolean(value);
}

function t_parse_date(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number") {
    const ts = Date.parse(value as any);
    if (!Number.isNaN(ts)) {
      return new Date(ts).toISOString();
    }
  }
  return value;
}

function t_regex_replace(value: unknown, pattern: string, replacement: string, flags?: string): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    const rx = new RegExp(pattern, flags);
    return value.replace(rx, replacement);
  } catch {
    return value;
  }
}

export function applyTransforms(value: unknown, transforms?: Transform[]): unknown {
  if (!transforms?.length) {
    return value;
  }
  let current = value;
  for (const transform of transforms) {
    switch (transform.kind) {
      case "to_number":
        current = t_to_number(current);
        break;
      case "clamp":
        current = t_clamp(current, transform.min, transform.max);
        break;
      case "wrap_array":
        current = t_wrap_array(current);
        break;
      case "pick":
        current = t_pick(current, transform.paths);
        break;
      case "merge":
        current = t_merge(current, transform.obj);
        break;
      case "to_string":
        current = t_to_string(current);
        break;
      case "to_boolean":
        current = t_to_boolean(current);
        break;
      case "parse_date":
        current = t_parse_date(current);
        break;
      case "regex_replace":
        current = t_regex_replace(current, transform.pattern, transform.replacement, transform.flags);
        break;
      default:
        break;
    }
  }
  return current;
}

/** ---------- Validators ---------- */

function v_required(value: unknown): boolean {
  return !(value === undefined || value === null || (typeof value === "string" && value.trim() === ""));
}

function v_min(value: unknown, min: number): boolean {
  return typeof value === "number" ? value >= min : true;
}

function v_max(value: unknown, max: number): boolean {
  return typeof value === "number" ? value <= max : true;
}

function v_regex(value: unknown, pattern: string, flags?: string): boolean {
  if (typeof value !== "string") {
    return true;
  }
  try {
    return new RegExp(pattern, flags).test(value);
  } catch {
    return true;
  }
}

function v_enum(value: unknown, allowed: Array<string | number | boolean>): boolean {
  return allowed.includes(value as any);
}

export function runValidators(value: unknown, validators?: Validator[]): MapResult<unknown> {
  if (!validators?.length) {
    return { ok: true, value };
  }
  const errors: MapError[] = [];
  for (const validator of validators) {
    const passed =
      validator.kind === "required"
        ? v_required(value)
        : validator.kind === "min"
          ? v_min(value, validator.value)
          : validator.kind === "max"
            ? v_max(value, validator.value)
            : validator.kind === "regex"
              ? v_regex(value, validator.pattern, validator.flags)
              : validator.kind === "enum"
                ? v_enum(value, validator.values)
                : true;
    if (!passed) {
      errors.push({ kind: "validator", message: `failed: ${validator.kind}` });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** ---------- Public API ---------- */

export function applyMapping(source: unknown, mapping: EdgeMapping): MapResult<unknown> {
  const jsonResult = runJsonPath(source, mapping.from);
  if (!jsonResult.ok) {
    return jsonResult;
  }
  let value = applyTransforms(jsonResult.value, mapping.transforms);
  if ((value === undefined || value === null) && mapping.default !== undefined) {
    value = mapping.default;
  }
  const validatorResult = runValidators(value, mapping.validators);
  if (!validatorResult.ok) {
    return validatorResult;
  }
  return { ok: true, value: validatorResult.value };
}

/** Evaluate all mappings on an edge, returning a single object keyed by `to`.
 * - Later mappings overwrite earlier ones (MVP behavior).
 * - `reduce: "list_concat"` concatenates the current array with previous values.
 */
export function applyEdgeMappings(source: unknown, mappings: EdgeMapping[]): MapResult<Record<string, unknown>> {
  const acc: Record<string, unknown> = {};
  const errors: MapError[] = [];
  for (const mapping of mappings ?? []) {
    const result = applyMapping(source, mapping);
    if (!result.ok) {
      errors.push(...result.errors);
      continue;
    }
    if (mapping.reduce === "list_concat") {
      const current = acc[mapping.to];
      const nextValue = Array.isArray(result.value)
        ? result.value
        : result.value == null
          ? []
          : [result.value];
      acc[mapping.to] = Array.isArray(current) ? [...current, ...nextValue] : nextValue;
      continue;
    }
    acc[mapping.to] = result.value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: acc };
}
