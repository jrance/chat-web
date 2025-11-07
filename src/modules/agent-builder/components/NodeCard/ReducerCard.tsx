import React from "react";
import type { ReducerNode } from "../../model/ir";

type Props = {
  node: ReducerNode;
  onChange: (next: ReducerNode) => void;
};

export const ReducerCard: React.FC<Props> = ({ node, onChange }) => {
  return (
    <div className="ab-card">
      <label className="ab-label">
        Strategy
        <select
          className="ab-input"
          value={node.config?.strategy ?? "list_concat"}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...(node.config ?? {}), strategy: e.target.value as "list_concat" },
            })
          }
        >
          <option value="list_concat">list_concat</option>
        </select>
      </label>
    </div>
  );
};

