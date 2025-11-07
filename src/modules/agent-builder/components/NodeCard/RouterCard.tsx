import React from "react";
import type { RouterLlmNode } from "../../model/ir";

type Props = {
  node: RouterLlmNode;
  onChange: (next: RouterLlmNode) => void;
};

export const RouterCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config;
  return (
    <div className="ab-card">
      <label className="ab-label">
        Branches (IDs, comma separated)
        <input
          className="ab-input"
          type="text"
          value={config.branches.join(", ")}
          onChange={(e) =>
            onChange({
              ...node,
              config: {
                ...config,
                branches: e.target.value
                  .split(",")
                  .map((b) => b.trim())
                  .filter(Boolean),
              },
            })
          }
        />
      </label>

      <label className="ab-label ab-label--check">
        <input
          type="checkbox"
          checked={config.returnConfidence ?? false}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, returnConfidence: e.target.checked },
            })
          }
        />
        Return confidence value
      </label>
    </div>
  );
};

