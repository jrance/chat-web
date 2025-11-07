import { describe, it, expect } from "vitest";

import { migrateToCurrent } from "../migrate";
import { IR_VERSION } from "../ir";

describe("migrate v0.2 -> v0.3", () => {
  it("bumps version and converts entry.file nodes", () => {
    const legacy = {
      version: "0.2",
      id: "legacy",
      name: "Legacy graph",
      nodes: [{ id: "entry", kind: "entry.file" }],
      edges: []
    };

    const next = migrateToCurrent(legacy);
    expect(next.version).toBe(IR_VERSION);
    expect(next.nodes.some((node) => node.kind === "entry.form")).toBe(true);
  });
});
