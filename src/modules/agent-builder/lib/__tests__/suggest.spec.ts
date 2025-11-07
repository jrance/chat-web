import { describe, it, expect } from "vitest";
import { suggestArtifactMappings } from "../suggest";
import type { FormSchema } from "../../model/form";

describe("suggestArtifactMappings", () => {
  it("returns JSONPath suggestions for file fields", () => {
    const schema: FormSchema = {
      id: "schema-1",
      fields: [
        { id: "fileA", name: "fileA", label: "File A", kind: "file" },
        { id: "fileB", name: "fileB", label: "File B", kind: "file", multiple: true },
        { id: "text", name: "notes", label: "Notes", kind: "text" },
      ],
    };

    const result = suggestArtifactMappings(schema);
    const paths = result.map((item) => item.jsonPath);
    expect(paths).toContain("$.form.values.fileA.file_id");
    expect(paths).toContain("$.form.values.fileB[*].file_id");
    expect(paths.length).toBe(3);
  });
});
