import React, { useMemo, useState } from "react";
import type { GraphDoc } from "../../model/ir";
import { DefaultToolRegistry } from "../../registry/tools.default";
import { buildExecuteEnvelope, type ExecuteEnvelope } from "../../exporter/request_envelope";

type Props = {
  doc: GraphDoc;
  sampleInput?: unknown;
};

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const ExporterPanel: React.FC<Props> = ({ doc, sampleInput }) => {
  const [tab, setTab] = useState<"envelope" | "tools" | "warnings">("envelope");
  const envelope = useMemo<ExecuteEnvelope>(
    () => buildExecuteEnvelope(doc, DefaultToolRegistry, (sampleInput as any) ?? {}),
    [doc, sampleInput],
  );
  const tools = envelope.tools;
  const warnings = envelope.orchestration.warnings ?? [];

  const filename = `${(doc.name || "orchestration").replace(/[^\w.-]+/g, "_")}.execute.json`;

  return (
    <section className="ab-exporter" aria-label="Exporter panel">
      <header className="ab-exporter-header">
        <strong>Exporter</strong>
        <div className="ab-tabs">
          <button
            type="button"
            className={`ab-tab ${tab === "envelope" ? "ab-tab--active" : ""}`}
            onClick={() => setTab("envelope")}
          >
            Envelope
          </button>
          <button
            type="button"
            className={`ab-tab ${tab === "tools" ? "ab-tab--active" : ""}`}
            onClick={() => setTab("tools")}
          >
            Tools
          </button>
          <button
            type="button"
            className={`ab-tab ${tab === "warnings" ? "ab-tab--active" : ""}`}
            onClick={() => setTab("warnings")}
          >
            Warnings {warnings.length ? `(${warnings.length})` : ""}
          </button>
        </div>
        <div className="ab-actions">
          <button
            type="button"
            className="ab-btn ab-btn-primary"
            onClick={() => downloadJson(envelope, filename)}
          >
            Download JSON
          </button>
        </div>
      </header>
      <div className="ab-exporter-body">
        {tab === "envelope" && (
          <pre className="ab-pre" aria-label="execute envelope">
            {JSON.stringify(envelope, null, 2)}
          </pre>
        )}
        {tab === "tools" && (
          <pre className="ab-pre" aria-label="tools preview">
            {JSON.stringify(tools, null, 2)}
          </pre>
        )}
        {tab === "warnings" &&
          (warnings.length ? (
            <ul className="ab-list">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          ) : (
            <div>No warnings</div>
          ))}
      </div>
    </section>
  );
};
