import React from "react";
import type { SequentialNode } from "../../model/ir";

type Props = {
  node: SequentialNode;
  onChange: (next: SequentialNode) => void;
};

function parseList(value: string): string[] {
  return value
    .split(/[,\\n]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export const SequentialCard: React.FC<Props> = ({ node, onChange }) => {
  const childrenValue = node.config.children.join(", ");
  return (
    <div className="ab-card">
      <label className="ab-label">
        Children Order
        <input
          className="ab-input"
          type="text"
          value={childrenValue}
          placeholder="agentA, reducer1"
          onChange={(e) => onChange({ ...node, config: { children: parseList(e.target.value) } })}
        />
        <small className="ab-help">Nodes run sequentially using this list.</small>
      </label>
    </div>
  );
};

