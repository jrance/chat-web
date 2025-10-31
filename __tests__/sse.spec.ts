import { afterEach, expect, test, vi } from "vitest";
import { sseIterator, parseResponsesEvent } from "../src/lib/orch/sse";
import { ResponsesEvent } from "../src/lib/orch/types";

const encoder = new TextEncoder();

const streamFromChunks = (chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

test("sseIterator yields parsed frames for complete events", async () => {
  const payload = [
    'event: response\n',
    'data: {"type":"response.created","id":"r1"}\n\n',
    'data: {"type":"response.output_text.delta","delta":"hello"}\n\n',
  ];
  const frames: Array<{ event?: string; data?: string }> = [];
  for await (const frame of sseIterator(streamFromChunks(payload))) {
    frames.push(frame);
  }
  expect(frames).toEqual([
    { event: "response", data: '{"type":"response.created","id":"r1"}' },
    { event: undefined, data: '{"type":"response.output_text.delta","delta":"hello"}' },
  ]);
});

test("sseIterator stitches partial chunks and parseResponsesEvent filters invalid entries", async () => {
  const chunks = [
    'data: {"type":"response.output_text.delta","delta":"hel',
    'lo"}\n\ndata: {"type":"response.output_text.done"}\n\n',
    ':comment\n\n',
    'data: [DONE]\n\n',
  ];

  const parsed: ResponsesEvent[] = [];
  for await (const frame of sseIterator(streamFromChunks(chunks))) {
    const event = parseResponsesEvent(frame);
    if (event) {
      parsed.push(event);
    }
  }

  expect(parsed).toEqual([
    { type: "response.output_text.delta", delta: "hello" },
    { type: "response.output_text.done" },
  ]);
});
