export type OrchestrationKind = "router" | "sequential" | "concurrent" | "groupchat" | "output";

export type AgentKind = "agent.codeless" | "agent.byoe" | "agent.remote";

export type ToolKind = "tool";
export type IntegrationKind = "mcpServer";

export type NodeKind = OrchestrationKind | AgentKind | ToolKind | IntegrationKind;

export const ORCHESTRATION_KINDS: OrchestrationKind[] = [
  "router",
  "sequential",
  "concurrent",
  "groupchat",
  "output",
];

export const AGENT_KINDS: AgentKind[] = [
  "agent.codeless",
  "agent.byoe",
  "agent.remote",
];

export const TOOL_KINDS: ToolKind[] = ["tool"];
export const INTEGRATION_KINDS: IntegrationKind[] = ["mcpServer"];

export const NODE_KINDS: NodeKind[] = [
  ...ORCHESTRATION_KINDS,
  ...AGENT_KINDS,
  ...TOOL_KINDS,
  ...INTEGRATION_KINDS,
];
