import type { GraphDoc } from "../model/ir";
import type { ToolRegistry } from "../model/tools";
import { compileGraph } from "./compile";
import { extractOpenAiTools, type OpenAiTool } from "./extract_tools";

export interface EntryInput {
  messages?: Array<{ role: "user" | "system" | "assistant" | "tool"; content: unknown }>;
  form?: Record<string, unknown>;
  files?: Array<{ file_id: string; name?: string; mime_type?: string }>;
  [key: string]: unknown;
}

export type ExecuteEnvelope = {
  api: { version: "v1"; sse: { format: "openai.responses" } };
  orchestration: ReturnType<typeof compileGraph>["graph"];
  tools: OpenAiTool[];
  input: EntryInput;
};

export function buildExecuteEnvelope(doc: GraphDoc, registry: ToolRegistry, input: EntryInput): ExecuteEnvelope {
  const { graph } = compileGraph(doc);
  const tools = extractOpenAiTools(doc, registry);
  return {
    api: { version: "v1", sse: { format: "openai.responses" } },
    orchestration: graph,
    tools,
    input,
  };
}
