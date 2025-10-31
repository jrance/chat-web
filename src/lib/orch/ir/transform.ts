import type { AgentToolBinding, ToolOverrides, Visibility } from "../../tools/shapes";
import { getToolById } from "../../tools/registry";

export function readAgentToolsFromIR(node: any, allNodes: any[]): AgentToolBinding[] {
  const attachedIds: string[] = node?.data?.tools?.attached ?? [];
  const bindings: AgentToolBinding[] = [];
  for (const toolNodeId of attachedIds) {
    const toolNode = allNodes.find(n => n.id === toolNodeId);
    if (!toolNode) continue;
    const toolId = toolNode?.data?.toolId ?? toolNode?.data?.name ?? "";
    const meta = getToolById(toolId);
    const overridesRaw = toolNode?.data?.parameterOverrides ?? {};
    const overrides: ToolOverrides = {};
    if (meta) {
      for (const def of meta.argsSchema) {
        const ov = overridesRaw[def.name];
        const vis: Visibility = (ov?.visibility) || (def as any).visibility || "Normal";
        const value = ov?.value ?? ov ?? (meta.defaults ? meta.defaults[def.name] : undefined);
        overrides[def.name] = { value, visibility: vis };
      }
    }
    bindings.push({ toolNodeId, toolId, overrides });
  }
  return bindings;
}

export function writeAgentToolsToIR(node: any, allNodes: any[], bindings: AgentToolBinding[]): { node: any, nodes: any[] } {
  // ensure attached list
  const attached = bindings.map(b => b.toolNodeId);
  node = { ...node, data: { ...node.data, tools: { ...(node.data?.tools || {}), attached } } };

  const nodes = allNodes.map(n => {
    const bind = bindings.find(b => b.toolNodeId === n.id);
    if (!bind) return n;
    const paramOv: Record<string, any> = {};
    for (const [name, ov] of Object.entries(bind.overrides || {})) {
      paramOv[name] = { value: ov.value, visibility: ov.visibility };
    }
    return {
      ...n,
      data: {
        ...(n.data || {}),
        toolId: bind.toolId,
        parameterOverrides: paramOv
      }
    };
  });

  return { node, nodes };
}
