import { NodeKind } from "./nodeTypes";

export type UUID = string;

export interface IRRootMeta {
  id: UUID;
  name: string;
  version: string; // IR version
  tenantId?: string;
  metadata?: Record<string, unknown>;
  draft?: boolean;
}

export interface BaseNode {
  id: UUID;
  kind: NodeKind;
  label: string;
  description?: string;
}

export interface RouterNode extends BaseNode {
  kind: "router";
  data: {
    prompt: string;
    minConfidence: number; // 0..1
    tieBreak: "HighestConfidence" | "DeterministicOrder" | "PreferList";
    tieBreakPrefer?: string[];
    fallback: {
      mode: "AskUserClarify" | "DefaultChild" | "SafeAgent" | "Error";
      defaultChild?: string;
    };
    allowBelowMinForTieBreak?: boolean; // hidden advanced, default false
    routeSchema: Record<string, any>;
    telemetry?: { labels?: Record<string, string> };
    targets?: string[]; // derived from child labels
    autoSyncEnum?: boolean; // default true
  };
}

export interface SequentialNode extends BaseNode {
  kind: "sequential";
  data: {
    breakOn?: "Never" | "OnFirstAnswer" | "HighConfidence";
    childrenOrder?: UUID[]; // strict execution order of child node ids
    childOverrides?: {
      [childId: string]: { enabled?: boolean; minConfidence?: number | null; stopAfter?: boolean };
    };
  };
}

export interface ConcurrentNode extends BaseNode {
  kind: "concurrent";
  data: {
    timeoutSec?: number;
    maxParallelism?: number;
    onChildError?: "SkipAndContinue" | "FailFast" | "CollectPartial";
    childrenOrder?: UUID[];
    childOverrides?: {
      [childId: string]: { enabled?: boolean; weight?: number };
    };
    merge?: {
      strategy: "Synthesize" | "HighestScore" | "FirstBest";
      synthPrompt?: string; // required for Synthesize
      scoreField?: string; // for HighestScore
      minScore?: number; // optional
      acceptRule?: string; // for FirstBest
    };
    includeChildTraces?: boolean;
  };
}

export interface GroupChatNode extends BaseNode {
  kind: "groupchat";
  data: {
    moderatorPrompt?: string;
    maxTurns?: number;
    stopWhen?: "ModeratorSatisfied" | "AllAgree";
  };
}

export interface CodelessAgentNode extends BaseNode {
  kind: "agent.codeless";
  data: {
    // Instructions
    systemInstructions: string;
    styleGuide?: string;

    // Model / Inference
    model: {
      provider: "openai" | "azureopenai" | "bedrock" | "ollama" | "other";
      modelId: string;
      temperature: number; // 0..2 default 0.3
      topP: number; // (0,1] default 1.0
      maxTokens: number; // default 800
      seed?: number | null;
      stop?: string[];
      jsonModeEnabled?: boolean;
    };

    // Context & Memory
    context: {
      historyWindow: { mode: "None" | "LastN" | "TimeBounded"; n?: number; durationMs?: number };
      injectOrgPreamble?: boolean;
      vars?: Record<string, string>;
    };

    // Tools
    tools?: {
      policy: "Disabled" | "Auto" | "AlwaysAsk" | "Heuristic";
      timeoutMs?: number;
      maxCallsPerTurn?: number;
      parallelism?: number;
      redactPII?: boolean;
      attached?: UUID[]; // references to Tool node ids
    };

    // Structured Output
    structuredOutput?: {
      enabled: boolean;
      schema?: Record<string, any>;
      onViolation?: "RetryAndRepair" | "ReturnError" | "BestEffort";
      maxRepairAttempts?: number;
      postProcess?: { normalizeWhitespace?: boolean; ensureMarkdown?: boolean; appendCitationsBlock?: boolean };
    };

    // Safety & Guardrails
    safety?: {
      policyRef?: string;
      onBlock?: "Refuse" | "SafeAgent" | "AskForClarification";
      safeAgentRef?: UUID;
      piiRedaction?: boolean;
      promptInjectionDefense?: boolean;
    };

    // Telemetry
    telemetry?: { labels?: Record<string, string>; emitUsage?: boolean };
  };
}

export interface BYOEAgentNode extends BaseNode {
  kind: "agent.byoe";
  data: Record<string, unknown>; // validated by BYOE schema via AJV
}

export interface RemoteAgentNode extends BaseNode {
  kind: "agent.remote";
  data: Record<string, unknown>; // validated by A2A schema via AJV
}

export interface ToolNode extends BaseNode {
  kind: "tool";
  data: {
    name: string;
    toolId?: string;
    version?: string;
    argsSchema?: Record<string, unknown>;
    parameterOverrides?: Record<string, any>;
  };
}

export interface OutputNode extends BaseNode {
  kind: "output";
  data: Record<string, never>;
}

export type IRNode =
  | RouterNode
  | SequentialNode
  | ConcurrentNode
  | GroupChatNode
  | CodelessAgentNode
  | BYOEAgentNode
  | RemoteAgentNode
  | ToolNode
  | MCPServerNode
  | OutputNode;

export interface IREdge {
  id: UUID;
  from: UUID;
  to: UUID;
  label?: string; // human-readable, used as Router target names
}

export interface IRGraph {
  meta: IRRootMeta;
  nodes: IRNode[];
  edges: IREdge[];
  entryId?: UUID; // declared entry node
}

// MCP Server node
export interface MCPServerNode extends BaseNode {
  kind: "mcpServer";
  data: {
    url: string;
    protocol: string; // e.g. mcp/1.0
    auth?: { type: "OBO" | "client_credentials" | "api_key" | "mtls"; scopes?: string[]; secretRef?: string | null };
    capabilities?: { tools?: boolean; resources?: boolean; prompts?: boolean; sampling?: boolean };
    namespaceFilter?: string[];
    metadata?: Record<string, unknown>;
  };
}
