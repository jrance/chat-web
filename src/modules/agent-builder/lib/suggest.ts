import type { FileField, FormSchema } from "../model/form";

export function suggestArtifactMappings(schema: FormSchema): Array<{
  label: string;
  jsonPath: string;
}> {
  const suggestions: Array<{ label: string; jsonPath: string }> = [];
  for (const field of schema.fields) {
    if (field.kind !== "file") continue;
    suggestions.push({
      label: `${field.label} (file_id)`,
      jsonPath: `$.form.values.${field.name}.file_id`,
    });
    if ((field as FileField).multiple) {
      suggestions.push({
        label: `${field.label} (all file_ids)`,
        jsonPath: `$.form.values.${field.name}[*].file_id`,
      });
    }
  }
  return suggestions;
}
