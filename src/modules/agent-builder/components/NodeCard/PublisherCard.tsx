import React from "react";
import type { PublisherNode } from "../../model/ir";

type Props = {
  node: PublisherNode;
  onChange: (next: PublisherNode) => void;
};

export const PublisherCard: React.FC<Props> = ({ node, onChange }) => {
  const config = node.config ?? {};
  return (
    <div className="ab-card">
      <label className="ab-label">
        Destination
        <select
          className="ab-input"
          value={config.destination ?? "sharepoint"}
          onChange={(e) =>
            onChange({
              ...node,
              config: { ...config, destination: e.target.value as PublisherNode["config"]["destination"] },
            })
          }
        >
          <option value="sharepoint">SharePoint</option>
          <option value="webhook">Webhook</option>
          <option value="s3">S3 Bucket</option>
        </select>
      </label>

      <label className="ab-label">
        Path / Target
        <input
          className="ab-input"
          type="text"
          value={config.path ?? ""}
          onChange={(e) => onChange({ ...node, config: { ...config, path: e.target.value } })}
        />
        <small className="ab-help">Example: /Shared Documents/report.csv</small>
      </label>
    </div>
  );
};

