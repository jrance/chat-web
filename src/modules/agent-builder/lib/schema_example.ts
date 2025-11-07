import type { JsonSchema } from "../model/tools";

export function exampleFromSchema(schema?: JsonSchema): any {
  if (!schema) return {};
  if (Array.isArray(schema.type)) {
    return exampleFromSchema({ ...schema, type: schema.type[0] });
  }
  switch (schema.type) {
    case "string":
      if (schema.enum?.length) return schema.enum[0];
      return schema.default ?? "";
    case "number":
    case "integer":
      return schema.default ?? 0;
    case "boolean":
      return schema.default ?? false;
    case "array":
      return [exampleFromSchema(schema.items)];
    case "object": {
      const props = schema.properties ?? {};
      return Object.keys(props).reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = exampleFromSchema(props[key]);
        return acc;
      }, {});
    }
    default:
      return schema.default ?? null;
  }
}
