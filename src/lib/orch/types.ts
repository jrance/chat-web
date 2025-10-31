export type WidgetEnvelope = {
  kind: string;
  version?: string;
  props?: Record<string, unknown>;
};

export type ResponseCompletionStatus = "completed" | "paused";

export type ResponseError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ResponseToolError = {
  code: string;
  message: string;
};

export type ResponseUsage = Record<string, unknown>;

export type ResponsesEvent =
  | { type: "response.created"; id?: string; run_id?: string }
  | { type: "response.output_text.delta"; delta: string; ui?: WidgetEnvelope }
  | { type: "response.output_text.done" }
  | { type: "response.function_call_arguments.delta"; name: string; arguments: string }
  | { type: "response.function_call_arguments.done"; name: string }
  | { type: "response.tool_result.created"; name: string; call_id?: string }
  | { type: "response.tool_result.done"; name: string; call_id?: string; result?: unknown; error?: ResponseToolError }
  | { type: "response.completed"; status: ResponseCompletionStatus; usage?: ResponseUsage; hitl?: unknown }
  | { type: "response.error"; error: ResponseError };

export type ExecuteOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Overrides the configured API base. Primarily used in tests. */
  baseUrl?: string;
};

export type ExecuteRequestBody = {
  ir: unknown;
  input: { text: string };
  options?: Record<string, unknown>;
};

export type ChatMessageRole = "user" | "assistant" | "tool" | "system";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  text?: string;
  widgets?: WidgetEnvelope[];
  tool?: {
    name: string;
    callId?: string;
    result?: unknown;
    error?: ResponseToolError;
  };
  time: number;
  done?: boolean;
};
