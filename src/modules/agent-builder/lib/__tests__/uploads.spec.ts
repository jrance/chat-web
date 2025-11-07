import { describe, it, expect } from "vitest";
import { collectFileRefs } from "../uploads";

describe("collectFileRefs", () => {
  it("finds nested file refs", () => {
    const values = {
      uploaded_file: { file_id: "f1", mime_type: "text/plain", display_name: "a.txt", size: 10 },
      attachments: [
        { file_id: "f2", mime_type: "image/png", display_name: "pic.png" },
        { file_id: "f3", mime_type: "application/pdf", display_name: "report.pdf" },
      ],
      nested: {
        extra: { file_id: "f4", mime_type: "text/csv", display_name: "data.csv" },
      },
    };
    const refs = collectFileRefs(values);
    expect(refs.map((r) => r.file_id)).toEqual(["f1", "f2", "f3", "f4"]);
  });
});
