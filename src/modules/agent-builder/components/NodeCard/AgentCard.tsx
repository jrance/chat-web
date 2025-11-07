import React from "react";
import type { AgentNode, InputPort } from "../../model/ir";

type Props = {
  node: AgentNode;
  onChange: (next: AgentNode) => void;
};

export const AgentCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config;
  const updateConfig = <K extends keyof AgentNode["config"]>(key: K, value: AgentNode["config"][K]) => {
    onChange({ ...node, config: { ...config, [key]: value } });
  };
  const meta = (node.meta ?? {}) as Record<string, unknown> & { combiner?: boolean };
  const isCombiner = Boolean(meta.combiner);

  const toggleCombiner = (checked: boolean) => {
    const inputs = node.inputs ?? [];
    const hasEvidence = inputs.some((input) => input.name === "evidence");
    let nextInputs: InputPort[] | undefined = node.inputs;
    if (checked && !hasEvidence) {
      nextInputs = [...inputs, { name: "evidence", required: true, schema: { type: "array" } }];
    } else if (!checked && hasEvidence) {
      nextInputs = inputs.filter((input) => input.name !== "evidence");
    }
    const nextMeta = { ...node.meta };
    if (checked) {
      nextMeta.combiner = true;
    } else if (nextMeta) {
      delete (nextMeta as Record<string, unknown>).combiner;
    }
    onChange({
      ...node,
      inputs: nextInputs,
      meta: nextMeta,
    });
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

      <div className="ab-field">
        <label className="ab-checkline">
          <input type="checkbox" checked={isCombiner} onChange={(event) => toggleCombiner(event.target.checked)} />
          Combiner mode (expects <code>evidence[]</code>)
        </label>
        <small className="ab-help">
          Adds a required <code>evidence</code> input port for fan-in from <code>parallel.branches</code>.
        </small>
      </div>
    </div>
  );
};
