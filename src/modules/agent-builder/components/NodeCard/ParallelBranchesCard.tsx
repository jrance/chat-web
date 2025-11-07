import React from "react";
import type { ParallelBranchesNode } from "../../model/ir";

type Props = {
  node: ParallelBranchesNode;
  onChange: (next: ParallelBranchesNode) => void;
};

function toList(value: string): string[] {
  return value
    .split(/[,\\n]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export const ParallelBranchesCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config;
  const broadcastValue = (config.broadcast ?? []).join(", ");
  const childrenValue = config.children.join(", ");

  return (
    <div className="ab-card">
      <label className="ab-label">
        Children (IDs)
        <input
          className="ab-input"
          type="text"
          value={childrenValue}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, children: toList(e.target.value) },
            })
          }
        />
      </label>

      <label className="ab-label">
        Broadcast Ports
        <input
          className="ab-input"
          type="text"
          value={broadcastValue}
          placeholder="messages, context"
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, broadcast: toList(e.target.value) },
            })
          }
        />
        <small className="ab-help">Broadcasted inputs are copied to every child before execution.</small>
      </label>

      <label className="ab-label">
        Join Strategy
        <select
          className="ab-input"
          value={typeof config.join === "string" ? config.join : "partial"}
          onChange={(e) => {
            if (e.target.value === "partial") {
              onChange({
                ...node,
                config: { ...config, join: { timeoutMs: 30_000, policy: "partial" } },
              });
              return;
            }
            onChange({ ...node, config: { ...config, join: e.target.value as "all" | "any" } });
          }}
        >
          <option value="all">Wait for all</option>
          <option value="any">Return on first success</option>
          <option value="partial">Timed partial</option>
        </select>
      </label>
    </div>
  );
};

