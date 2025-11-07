import type { GraphDoc } from "../model/ir";
import type { ToolDef, ToolRegistry } from "../model/tools";

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
};

function sanitizeName(id: string): string {
  return id.replace(/[^a-z0-9_\-]/gi, "_").slice(0, 64);
}

function toOpenAiTool(def: ToolDef, variantId?: string | null): OpenAiTool {
  const variant = (def.variants ?? []).find((v) => v.id === (variantId ?? undefined));
  const schema = (variant?.parameters ?? def.parameters) ?? { type: "object" };
  return {
    type: "function",
    function: {
      name: sanitizeName(def.id),
      description: def.description,
      parameters: schema,
    },
  };
}

export function extractOpenAiTools(doc: GraphDoc, registry: ToolRegistry): OpenAiTool[] {
  const tools = new Map<string, OpenAiTool>();
  for (const node of doc.nodes) {
    if (node.kind !== "agent") continue;
    const allowed = Array.isArray((node as any).config?.allowedTools) ? (node as any).config.allowedTools : [];
    for (const ref of allowed) {
      if (!ref?.toolId) continue;
      const def = registry.get(ref.toolId);
      if (!def) continue;
      const key = `${def.id}:${ref.variantId ?? ""}`;
      if (!tools.has(key)) {
        tools.set(key, toOpenAiTool(def, ref.variantId));
      }
    }
  }
  return Array.from(tools.values());
}
