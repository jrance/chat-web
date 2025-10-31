import type { ToolMeta } from "./shapes";
import webSearch from "./builtins/webSearch.meta";

const ALL: ToolMeta[] = [webSearch];

export function listTools(): ToolMeta[] { return ALL.slice(); }
export function getToolById(toolId: string): ToolMeta | undefined { return ALL.find(t => t.toolId === toolId); }
