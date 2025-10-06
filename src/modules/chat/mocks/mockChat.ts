import { DEFAULT_TENANT_ID } from "../config/chatConfig";
import type { HistoryItem, Paged, SendMessagePayload, StructuredState } from "../model/types";
import { applyPatch } from "fast-json-patch";

type Handler = (type: string, data: unknown, id?: string) => void;

type MockEvent = {
  type: string;
  data: Record<string, unknown>;
  delay: number;
  id: string;
};

type MockRun = {
  key: string;
  events: MockEvent[];
  assistantTurn: HistoryItem;
  timeouts: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
  dispatched: Set<string>;
};

const sessionHistories = new Map<string, HistoryItem[]>();
const mockRuns = new Map<string, MockRun>();

function sessionKey(tenantId: string, sessionId: string): string {
  return `${tenantId}::${sessionId}`;
}

function ensureHistory(tenantId: string, sessionId: string): HistoryItem[] {
  const key = sessionKey(tenantId, sessionId);
  if (!sessionHistories.has(key)) {
    sessionHistories.set(key, createSeedHistory(tenantId, sessionId));
  }
  return sessionHistories.get(key)!;
}

function createSeedHistory(tenantId: string, sessionId: string): HistoryItem[] {
  const createdAt = new Date().toISOString();
  const intro: HistoryItem = {
    id: `assistant-${sessionId}-welcome`,
    role: "assistant",
    text: "Hi there! This is a mock chat session while the real service is being built. Ask me anything!",
    createdAt,
  };
  if (tenantId !== DEFAULT_TENANT_ID) {
    intro.text = `Tenant ${tenantId} mock assistant here. How can I help today?`;
  }
  return [intro];
}

function buildAssistantResponse(_text: string, _agentId?: string): string {
  // Rich markdown message: How LLMs work — includes headings, table, code, links
  return `# How Large Language Models (LLMs) Work

LLMs are probabilistic next-token predictors trained on large text corpora using the Transformer architecture. The short version:

- Tokenize text into discrete tokens
- Train a Transformer to predict the next token (self-supervised learning)
- Use attention to condition on prior tokens and context
- Sample tokens with decoding strategies (greedy, top-k, nucleus)
- Optionally align with human preferences (e.g., RLHF)

## Training Phases

| Phase        | Data                       | Objective                 | Outcome                |
|--------------|----------------------------|---------------------------|------------------------|
| Pretraining  | Web/books/code/wikipedia   | Next token prediction     | General language prior |
| SFT          | Curated instruction data   | Supervised fine-tuning    | Instruction following  |
| RLHF/RLAIF   | Preference/comparison data | Optimize reward (policy)  | Helpful, harmless, honest |

## Inference (Sampling)

1. Encode prompt into tokens with a tokenizer
2. Run tokens through the Transformer; attention mixes information across positions
3. Obtain a probability distribution over the next token
4. Sample or select a token; append to the sequence and repeat

### Tiny Attention Pseudocode

\`\`\`python
import torch

def scaled_dot_product_attention(Q, K, V, mask=None):
    scores = Q @ K.transpose(-1, -2) / Q.size(-1) ** 0.5
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    weights = torch.softmax(scores, dim=-1)
    return weights @ V
\`\`\`

## Limitations

- Can hallucinate plausible but incorrect facts
- Limited window of context; older tokens can be forgotten
- Reflects biases of pretraining data

## Further Reading

- Transformer paper: [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- Illustrated guide: [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)
- Tokenizers: [Hugging Face Tokenizers](https://huggingface.co/docs/tokenizers/index)
- Alignment: [RLHF overview](https://openai.com/blog/instruction-following) and [Preference Learning](https://arxiv.org/abs/1909.08593)
`;
}

function buildStructuredArticle(): StructuredState {
  return {
    schemaId: "article.summary@1.0.0",
    schemaVersion: "1.0.0",
    valid: false,
    object: {
      title: "How Large Language Models (LLMs) Work",
      tldr: [
        "Tokenize text into tokens",
        "Train with next-token prediction",
        "Use attention at inference",
        "Sample with decoding strategies",
        "Align with preferences (RLHF)",
      ],
      phases: [
        { phase: "Pretraining", data: "Web/books/code/wikipedia", objective: "Next token prediction", outcome: "Language prior" },
        { phase: "SFT", data: "Curated instruction data", objective: "Supervised fine-tuning", outcome: "Instruction following" },
        { phase: "RLHF/RLAIF", data: "Preference/comparison data", objective: "Optimize reward (policy)", outcome: "Helpful/harmless/honest" },
      ],
      references: [
        { label: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762" },
        { label: "The Illustrated Transformer", url: "https://jalammar.github.io/illustrated-transformer/" },
        { label: "Hugging Face Tokenizers", url: "https://huggingface.co/docs/tokenizers/index" },
        { label: "Preference Learning", url: "https://arxiv.org/abs/1909.08593" },
      ],
    },
  };
}

function chunkResponse(response: string, chunkCount: number): string[] {
  const trimmed = response.trim();
  if (!trimmed) {
    return ["Let me think about that for a moment."];
  }

  const targetChunks = Math.max(1, Math.min(chunkCount, Math.ceil(trimmed.length / 40)));
  const chunkSize = Math.max(1, Math.ceil(trimmed.length / targetChunks));

  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length; i += chunkSize) {
    chunks.push(trimmed.slice(i, i + chunkSize));
  }

  return chunks.length > 0 ? chunks : [trimmed];
}

function makeEvents(runId: string, response: string): MockEvent[] {
  const chunks = chunkResponse(response, 6);
  let delay = 300;
  const events: MockEvent[] = [
    { type: "session.started", data: { turnId: runId }, delay: 200, id: `${runId}-start` },
  ];

  // Stream the first half of the markdown text
  chunks.forEach((chunk, index) => {
    events.push({
      type: "message.delta",
      data: { text: chunk },
      delay,
      id: `${runId}-delta-${index}`,
    });
    delay = 180;
  });

  // Interleave a structured payload via schema + json.patch + json.done
  const structured = buildStructuredArticle();
  events.push({ type: "schema", data: { schemaId: structured.schemaId, schemaVersion: structured.schemaVersion }, delay: 350, id: `${runId}-schema` });

  const patch = [
    { op: "add", path: "/title", value: structured.object.title },
    { op: "add", path: "/tldr", value: structured.object.tldr },
    { op: "add", path: "/phases", value: structured.object.phases },
    { op: "add", path: "/references", value: structured.object.references },
  ];
  events.push({ type: "json.patch", data: { patch }, delay: 220, id: `${runId}-patch-1` });
  events.push({ type: "json.done", data: {}, delay: 180, id: `${runId}-json-done` });

  // Wrap up
  events.push({ type: "completed", data: {}, delay: 500, id: `${runId}-completed` });
  return events;
}

export async function mockFetchHistory(tenantId: string, sessionId: string, _cursor?: string): Promise<Paged<HistoryItem>> {
  const history = ensureHistory(tenantId, sessionId);
  const items = history
    .slice()
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.localeCompare(b.createdAt);
    });
  return { items, nextCursor: null };
}

export async function mockSendMessage(tenantId: string, payload: SendMessagePayload): Promise<{ runId: string }> {
  const history = ensureHistory(tenantId, payload.sessionId);
  const userTurn: HistoryItem = {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    text: payload.text,
    createdAt: new Date().toISOString(),
  };
  history.push(userTurn);

  const runId = crypto.randomUUID();
  const assistantTurn: HistoryItem = {
    id: `assistant-${runId}`,
    role: "assistant",
    text: "",
    createdAt: new Date().toISOString(),
    isStreaming: true,
  };
  const response = buildAssistantResponse(payload.text, payload.agentId);
  const events = makeEvents(runId, response);

  mockRuns.set(runId, {
    key: sessionKey(tenantId, payload.sessionId),
    events,
    assistantTurn,
    timeouts: [],
    cancelled: false,
    dispatched: new Set<string>(),
  });

  return { runId };
}

export async function mockCancelRun(_tenantId: string, runId: string): Promise<void> {
  const run = mockRuns.get(runId);
  if (!run) return;
  run.cancelled = true;
  run.timeouts.forEach(clearTimeout);
  mockRuns.delete(runId);
}

function finalizeRun(runId: string, run: MockRun) {
  const history = sessionHistories.get(run.key);
  if (!history) return;
  const assistantTurn: HistoryItem = {
    ...run.assistantTurn,
    isStreaming: false,
    text: (run.assistantTurn.text ?? "").trim() || "(No response generated)",
    createdAt: new Date().toISOString(),
  };
  history.push(assistantTurn);
  mockRuns.delete(runId);
}

function snapshotHistory(run: MockRun): Paged<HistoryItem> {
  const history = sessionHistories.get(run.key) ?? [];
  const items = history
    .slice()
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map((item) => ({ ...item }));
  return { items, nextCursor: null };
}

export function mockSubscribe(runId: string, handler: Handler): () => void {
  const run = mockRuns.get(runId);
  if (!run) {
    return () => undefined;
  }

  run.cancelled = false;
  run.timeouts.forEach(clearTimeout);
  run.timeouts = [];

  let elapsed = 0;
  run.events.forEach((event) => {
    elapsed += event.delay;
    const timeoutId = setTimeout(() => {
      if (run.cancelled) {
        return;
      }
      if (run.dispatched.has(event.id)) {
        return;
      }
      run.dispatched.add(event.id);
      if (event.type === "message.delta" && typeof (event.data as any)?.text === "string") {
        run.assistantTurn.text = `${run.assistantTurn.text ?? ""}${(event.data as any).text}`;
      }
      if (event.type === "schema") {
        const { schemaId, schemaVersion } = (event.data as any) ?? {};
        run.assistantTurn.structured = {
          schemaId: schemaId ?? "unknown",
          schemaVersion: schemaVersion ?? "",
          object: {},
          valid: false,
        };
      }
      if (event.type === "json.patch") {
        const patch = (event.data as any)?.patch ?? [];
        if (!run.assistantTurn.structured) {
          run.assistantTurn.structured = { schemaId: "unknown", schemaVersion: "", object: {}, valid: false };
        }
        try {
          const result = applyPatch(structuredClone(run.assistantTurn.structured.object), patch);
          run.assistantTurn.structured.object = result.newDocument;
        } catch {
          // swallow patch errors in mock
        }
      }
      if (event.type === "json.done") {
        if (run.assistantTurn.structured) run.assistantTurn.structured.valid = true;
      }
      if (event.type === "completed") {
        finalizeRun(runId, run);
        const snapshot = snapshotHistory(run);
        handler("history.sync", snapshot, `${event.id}-history`);
      }
      handler(event.type, event.data, event.id);
    }, elapsed);
    run.timeouts.push(timeoutId);
  });

  return () => {
    run.cancelled = true;
    run.timeouts.forEach(clearTimeout);
  };
}
