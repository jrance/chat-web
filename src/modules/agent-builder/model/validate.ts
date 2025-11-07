import { z } from "zod";

import { IR_VERSION, GraphDoc, JsonSchema } from "./ir";

const jsonSchemaZ: z.ZodType<JsonSchema> = z.lazy(() =>
  z.object({
    type: z.union([z.string(), z.array(z.string())]).optional(),
    properties: z.record(jsonSchemaZ).optional(),
    items: jsonSchemaZ.optional(),
    required: z.array(z.string()).optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    format: z.string().optional(),
    description: z.string().optional(),
    additionalProperties: z.union([z.boolean(), jsonSchemaZ]).optional(),
    examples: z.array(z.unknown()).optional()
  })
);

const portSchemaZ = z.object({
  type: z.enum([
    "string",
    "number",
    "boolean",
    "datetime",
    "artifact",
    "object",
    "array",
    "send_payload"
  ]),
  jsonSchema: jsonSchemaZ.optional(),
  reducer: z.enum(["list_concat"]).optional(),
  example: z.unknown().optional()
});

const inputPortZ = z.object({
  name: z.string().min(1),
  schema: portSchemaZ,
  required: z.boolean().optional()
});

const outputPortZ = z.object({
  name: z.string().min(1),
  schema: portSchemaZ
});

const idZ = z.string().min(1);

const transformZ = z.object({
  kind: z.enum([
    "to_number",
    "clamp",
    "wrap_array",
    "pick",
    "merge",
    "to_string",
    "to_boolean",
    "parse_date",
    "regex_replace"
  ]),
  min: z.number().optional(),
  max: z.number().optional(),
  paths: z.array(z.string()).optional(),
  obj: z.record(z.unknown()).optional(),
  format: z.string().optional(),
  pattern: z.string().optional(),
  replacement: z.string().optional(),
  flags: z.string().optional()
});

const validatorZ = z.object({
  kind: z.enum(["required", "min", "max", "regex", "enum"]),
  value: z.number().optional(),
  pattern: z.string().optional(),
  flags: z.string().optional(),
  values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const edgeMappingZ = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  transforms: z.array(transformZ).optional(),
  default: z.unknown().optional(),
  validators: z.array(validatorZ).optional(),
  reduce: z.enum(["list_concat"]).optional()
});

const edgeZ = z.object({
  id: idZ,
  from: z.object({ nodeId: idZ, port: z.string().min(1) }),
  to: z.object({ nodeId: idZ, port: z.string().min(1) }),
  mappings: z.array(edgeMappingZ)
});

const baseNodeZ = z.object({
  id: idZ,
  kind: z.enum([
    "entry.form",
    "agent",
    "sequential",
    "router.llm",
    "parallel.items",
    "parallel.branches",
    "reducer",
    "publisher"
  ]),
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.unknown()).optional(),
  inputs: z.array(inputPortZ).optional(),
  outputs: z.array(outputPortZ).optional()
});

export const graphDocZ = z
  .object({
    version: z.literal(IR_VERSION),
    id: idZ,
    name: z.string().min(1),
    meta: z.record(z.unknown()).optional(),
    nodes: z.array(baseNodeZ).min(1),
    edges: z.array(edgeZ)
  })
  .strict() satisfies z.ZodType<GraphDoc>;

export function validateGraphDoc(doc: unknown) {
  return graphDocZ.safeParse(doc);
}
