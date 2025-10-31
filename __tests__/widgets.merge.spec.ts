import { describe, it, expect } from "vitest";
import { mergeEnvelopes } from "../src/lib/widgets/merge";
import { WidgetEnvelope } from "../src/lib/widgets/registry";

describe("Widget Envelope Merge", () => {
  it("should return existing array when incoming is undefined", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test" }];
    const result = mergeEnvelopes(existing, undefined);
    expect(result).toEqual(existing);
  });

  it("should add new envelope when not present", () => {
    const existing: WidgetEnvelope[] = [];
    const incoming: WidgetEnvelope = { kind: "test", props: { value: 1 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(incoming);
  });

  it("should merge props for same kind without id", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test", props: { a: 1 } }];
    const incoming: WidgetEnvelope = { kind: "test", props: { b: 2 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].props).toEqual({ a: 1, b: 2 });
  });

  it("should override props for same key", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test", props: { value: 1 } }];
    const incoming: WidgetEnvelope = { kind: "test", props: { value: 2 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].props).toEqual({ value: 2 });
  });

  it("should merge by kind+id when id is present", () => {
    const existing: WidgetEnvelope[] = [
      { kind: "test", id: "1", props: { a: 1 } },
      { kind: "test", id: "2", props: { b: 2 } }
    ];
    const incoming: WidgetEnvelope = { kind: "test", id: "1", props: { c: 3 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result[0].props).toEqual({ a: 1, c: 3 });
    expect(result[1].props).toEqual({ b: 2 });
  });

  it("should add new envelope when kind+id not found", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test", id: "1", props: { a: 1 } }];
    const incoming: WidgetEnvelope = { kind: "test", id: "2", props: { b: 2 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it("should handle array of incoming envelopes", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test1", props: { a: 1 } }];
    const incoming: WidgetEnvelope[] = [
      { kind: "test2", props: { b: 2 } },
      { kind: "test3", props: { c: 3 } }
    ];
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result).toHaveLength(3);
  });

  it("should not mutate original arrays", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test", props: { a: 1 } }];
    const incoming: WidgetEnvelope = { kind: "test", props: { b: 2 } };
    
    const existingCopy = JSON.parse(JSON.stringify(existing));
    mergeEnvelopes(existing, incoming);
    
    expect(existing).toEqual(existingCopy);
  });

  it("should handle envelopes without props", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test" }];
    const incoming: WidgetEnvelope = { kind: "test", props: { a: 1 } };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result[0].props).toEqual({ a: 1 });
  });

  it("should handle version updates", () => {
    const existing: WidgetEnvelope[] = [{ kind: "test", version: "1.0" }];
    const incoming: WidgetEnvelope = { kind: "test", version: "2.0" };
    
    const result = mergeEnvelopes(existing, incoming);
    expect(result[0].version).toBe("2.0");
  });
});
