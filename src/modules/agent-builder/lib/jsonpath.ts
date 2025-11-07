/* Lightweight JSONPath adapter with a safe fallback evaluator.
 * - Tries to use "jsonpath-plus" if available at runtime.
 * - Falls back to a tiny parser that supports:
 *     $.a.b
 *     $.a[0]
 *     $.a[*]
 *     $.a.b[*].c
 * No filters or expressions; always returns an array of matches.
 */
export type JsonPath = string;

type EvalFn = (root: unknown, path: JsonPath) => any[];

let impl: EvalFn | null = null;

function fallbackEval(root: any, path: string): any[] {
  if (typeof path !== "string" || path[0] !== "$") {
    return [];
  }

  const segments: string[] = [];
  let buffer = "";
  let inBracket = false;
  for (let i = 1; i < path.length; i++) {
    const ch = path[i];
    if (ch === "[") {
      inBracket = true;
    } else if (ch === "]") {
      inBracket = false;
    }
    if (ch === "." && !inBracket) {
      if (buffer) {
        segments.push(buffer);
        buffer = "";
      }
      continue;
    }
    buffer += ch;
  }
  if (buffer) {
    segments.push(buffer);
  }

  let current: any[] = [root];
  for (const segment of segments) {
    const next: any[] = [];
    for (const node of current) {
      if (node == null) {
        continue;
      }
      const match = /^([^\[]+)(\[([^\]]+)\])?$/.exec(segment);
      if (!match) {
        continue;
      }
      const key = match[1];
      const idx = match[3];
      const target = (node as Record<string, any>)[key];
      if (idx == null) {
        if (target !== undefined) {
          next.push(target);
        }
        continue;
      }
      if (idx === "*") {
        if (Array.isArray(target)) {
          next.push(...target);
        } else if (target && typeof target === "object") {
          next.push(...Object.values(target));
        }
        continue;
      }
      const numeric = Number(idx);
      if (Number.isNaN(numeric)) {
        continue;
      }
      if (Array.isArray(target) && target[numeric] !== undefined) {
        next.push(target[numeric]);
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
      impl = (json, expr) => JSONPath({ path: expr, json });
    } catch {
      impl = fallbackEval;
    }
  }
  return impl(root, path);
}
