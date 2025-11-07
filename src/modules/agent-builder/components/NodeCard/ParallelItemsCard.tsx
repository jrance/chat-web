import React, { useState } from "react";
import type { ParallelItemsNode } from "../../model/ir";
import { ParallelItemsSimulator } from "../Simulator/ParallelItemsSimulator";

type Props = {
  node: ParallelItemsNode;
  onChange: (next: ParallelItemsNode) => void;
};

export const ParallelItemsCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config;
  const [showSim, setShowSim] = useState(false);
  return (
    <div className="ab-card">
      <label className="ab-label">
        Concurrency
        <input
          className="ab-input"
          type="number"
          min={1}
          max={256}
          value={config.concurrency}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, concurrency: Math.max(1, Number(e.target.value || 1)) },
            })
          }
        />
      </label>

      <label className="ab-label">
        Worker Node Id
        <input
          className="ab-input"
          type="text"
          value={config.workerId}
          onChange={(e) => onChange({ ...node, config: { ...config, workerId: e.target.value } })}
        />
        <small className="ab-help">Worker must exist in the canvas and accept the item payload.</small>
      </label>

      <label className="ab-label">
        Item Port (source array)
        <input
          className="ab-input"
          type="text"
          value={config.itemPort ?? ""}
          placeholder="items"
          onChange={(e) => onChange({ ...node, config: { ...config, itemPort: e.target.value } })}
        />
      </label>

      <div className="ab-divider" />

      <button type="button" className="ab-btn" onClick={() => setShowSim((v) => !v)}>
        {showSim ? "Hide" : "Open"} Concurrency Simulator
      </button>

      {showSim && (
        <div className="ab-sim-wrap">
          <ParallelItemsSimulator defaultConcurrency={config.concurrency} workerId={config.workerId} />
        </div>
      )}
    </div>
  );
};
