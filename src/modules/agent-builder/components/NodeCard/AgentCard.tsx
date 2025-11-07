import React from "react";
import type { AgentNode } from "../../model/ir";

type Props = {
  node: AgentNode;
  onChange: (next: AgentNode) => void;
};

export const AgentCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config;
  const updateConfig = <K extends keyof AgentNode["config"]>(key: K, value: AgentNode["config"][K]) => {
    onChange({ ...node, config: { ...config, [key]: value } });
  };

  return (
    <div className="ab-card">
      <label className="ab-label">
        Display Name
        <input className="ab-input" type="text" value={node.name ?? ""} onChange={(e) => onChange({ ...node, name: e.target.value })} />
      </label>

      <label className="ab-label">
        Model
        <input className="ab-input" type="text" value={config.model ?? ""} placeholder="gpt-4o-mini" onChange={(e) => updateConfig("model", e.target.value)} />
      </label>

      <label className="ab-label">
        Allowed Tools (comma separated)
        <input
          className="ab-input"
          type="text"
          value={(config.allowedTools ?? []).join(", ")}
          onChange={(e) => {
            const parts = e.target.value
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            updateConfig("allowedTools", parts);
          }}
        />
      </label>

      <div className="ab-field ab-field--row">
        <label>
          <input
            type="checkbox"
            checked={config.historyWindow?.type === "tokens"}
            onChange={(e) => {
              if (!e.target.checked) {
                updateConfig("historyWindow", undefined);
                return;
              }
              updateConfig("historyWindow", { type: "tokens", max: 4096 });
            }}
          />
          Token window (4096 default)
        </label>
      </div>
    </div>
  );
};

