import type { ToolMeta } from "./shapes";
import ddgs from "./builtins/ddgs.meta";

const ALL: ToolMeta[] = [ddgs];

export function listTools(): ToolMeta[] { return ALL.slice(); }
export function getToolById(toolId: string): ToolMeta | undefined { return ALL.find(t => t.toolId === toolId); }
