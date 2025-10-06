export type Role = 'user'|'assistant'|'tool';

export interface ToolCall {
  requestId: string;
  name: string;
  ok?: boolean;
  argsSummary?: string;
  resultSummary?: string;
  blobUri?: string | null;
  error?: { code: string; message: string } | null;
}

export interface StructuredState {
  schemaId: string;
  schemaVersion: string;
  object: any;        // evolves via json.patch
  valid: boolean;     // set on json.done
}

export interface ChatTurn {
  id: string;                  // messageId or synthetic during streaming
  role: Role;
  agent?: string;
  text?: string;               // built from message.delta
  structured?: StructuredState;
  toolCalls?: ToolCall[];
  createdAt?: string;
  isStreaming?: boolean;
  error?: { code: string; message: string } | null;
}

export interface HistoryItem extends ChatTurn {}
export interface Usage { input: number; output: number; }

export interface StreamCursor {
  lastEventId?: string;        // for Last-Event-ID resume
}

export interface SendMessagePayload {
  sessionId: string;
  text: string;
  agentId?: string;
  attachments?: Array<{ name: string; uri: string }>;
}

export interface Paged<T> { items: T[]; nextCursor?: string | null; }
