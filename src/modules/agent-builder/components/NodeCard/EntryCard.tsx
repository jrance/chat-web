import React from "react";
import type { EntryFormNode } from "../../model/ir";

type Props = {
  node: EntryFormNode;
  onChange: (next: EntryFormNode) => void;
};

export const EntryCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config ?? { withMessages: true };
  return (
    <div className="ab-card">
      <label className="ab-label">
        Form Schema Id
        <input
          className="ab-input"
          type="text"
          value={config.formSchemaId ?? ""}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, formSchemaId: e.target.value || undefined },
            })
          }
        />
      </label>
      <label className="ab-label ab-label--check">
        <input
          type="checkbox"
          checked={config.withMessages ?? true}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, withMessages: e.target.checked },
            })
          }
        />
        Include chat transcript
      </label>
    </div>
  );
};

