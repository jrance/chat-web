import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import a2aSchema from "../model/schemas/a2a.schema.json";
import byoeSchema from "../model/schemas/byoe.schema.json";
import { useAgentBuilder } from "../store/AgentBuilderContext";

export default function RJSFForm({ nodeId, schemaKind }: { nodeId: string; schemaKind: "a2a" | "byoe" | "codeless" }) {
  const { state, dispatch } = useAgentBuilder();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  let schema: any = {};
  if (schemaKind === "a2a") schema = a2aSchema;
  if (schemaKind === "byoe") schema = byoeSchema;
  if (schemaKind === "codeless") {
    schema = {
      title: "LLM Model",
      type: "object",
      properties: {
        instructions: { type: "string" },
        model: {
          type: "object",
          properties: {
            provider: { type: "string" },
            modelId: { type: "string" },
            temperature: { type: "number", minimum: 0, maximum: 2 },
            topP: { type: "number", minimum: 0, maximum: 1 },
            maxTokens: { type: "number", minimum: 1 },
            seed: { type: "number" }
          }
        }
      }
    };
  }

  const formData = (node.data as any) ?? {};

  return (
    <Form
      schema={schema}
      validator={validator}
      formData={formData}
      uiSchema={{}}
      liveValidate
      onChange={(e) => {
        const nodes = state.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as any), ...(e.formData as any) } } : n));
        dispatch({ type: "SET_FLOW", nodes, edges: state.edges });
      }}
    >
      <div />
    </Form>
  );
}

