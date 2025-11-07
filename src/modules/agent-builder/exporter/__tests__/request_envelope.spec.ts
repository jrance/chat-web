import { describe, expect, it } from "vitest";
import { buildExecuteEnvelope } from "../request_envelope";

const registry = {
  list: () => [],
  get: (_: string) => undefined,
} as any;

describe("buildExecuteEnvelope", () => {
  it("includes api metadata and compiled graph", () => {
    const doc: any = { id: "g", name: "t", nodes: [], edges: [] };
    const env = buildExecuteEnvelope(doc, registry, { messages: [{ role: "user", content: "hi" }] });
    expect(env.api.sse.format).toBe("openai.responses");
    expect(env.orchestration.version).toBe("eng-0.1");
    expect(env.tools).toEqual([]);
  });
});
