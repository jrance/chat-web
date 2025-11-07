import type { NodeAny, OutputPort } from "../model/ir";
import { EntryOutputs } from "../model/form";

export function buildNodeOutputPreview(node?: NodeAny): Record<string, unknown> | undefined {
  if (!node) {
    return undefined;
  }
  if (node.kind === "entry.form") {
    const sample: EntryOutputs = {
      messages: [{ role: "user", content: "Example prompt from user" }],
      form: { values: { title: "Quarterly Report", concurrency: "4" } },
      files: [{ file_id: "file-123", mime_type: "text/plain", display_name: "notes.txt" }],
    };
    return sample as Record<string, unknown>;
  }
  const outputs = node.outputs ?? [];
  if (!outputs.length) {
    return undefined;
  }
  const preview: Record<string, unknown> = {};
  outputs.forEach((port) => {
    preview[port.name] = port.schema.example ?? defaultValueForType(port);
  });
  return preview;
}

function defaultValueForType(port: OutputPort): unknown {
  switch (port.schema.type) {
    case "string":
      return "sample string";
    case "number":
      return 1;
    case "boolean":
      return true;
    case "datetime":
      return new Date().toISOString();
    case "array":
      return [];
    case "artifact":
      return { file_id: "file-xyz", display_name: "artifact.txt", mime_type: "text/plain" };
    case "object":
      return { sample: true };
    case "send_payload":
      return { kind: "payload", payload: {} };
    default:
      return null;
  }
}
