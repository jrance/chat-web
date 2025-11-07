import React, { useMemo, useState } from "react";
import type { ToolDef, ToolVariant } from "../../model/tools";
import { exampleFromSchema } from "../../lib/schema_example";

type Props = {
  tool: ToolDef;
  variant?: ToolVariant | null;
};

export const ToolSchemaViewer: React.FC<Props> = ({ tool, variant }) => {
  const schema = variant?.parameters ?? tool.parameters;
  const example = useMemo(() => exampleFromSchema(schema), [schema]);
  const [open, setOpen] = useState(false);

  if (!schema) return null;

  return (
    <div className="ab-tool-schema">
      <button type="button" className="ab-btn" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Hide" : "Show"} Schema
      </button>
      {open && (
        <div className="ab-schema-panels">
          <div>
            <label>Parameters JSON Schema</label>
            <pre className="ab-pre">{JSON.stringify(schema, null, 2)}</pre>
          </div>
          <div>
            <label>Example Arguments</label>
            <pre className="ab-pre">{JSON.stringify(example, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
