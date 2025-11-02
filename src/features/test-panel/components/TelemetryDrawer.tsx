import { useMemo, useState } from "react";
import type { TelemetryRow } from "../../../lib/orch/telemetry";

type Props = {
  rows: TelemetryRow[];
  enabled?: boolean;
};

export default function TelemetryDrawer({ rows, enabled = true }: Props) {
  const [tab, setTab] = useState<"timeline" | "raw">("timeline");
  const latest = useMemo(() => rows.slice(-200), [rows]); // bound size

  return (
    <section className="ab-testchat__drawer">
      <div className="ab-drawer__tabs">
        <button
          type="button"
          onClick={() => setTab("timeline")}
          className={`ab-drawer__tab ${tab === "timeline" ? "ab-drawer__tab--active" : ""}`}
        >
          Timeline
        </button>
        <button
          type="button"
          onClick={() => setTab("raw")}
          className={`ab-drawer__tab ${tab === "raw" ? "ab-drawer__tab--active" : ""}`}
        >
          Raw
        </button>
        <div className="ab-drawer__count">{latest.length}</div>
      </div>

      {!enabled && (
        <div className="ab-testchat__hint">Telemetry is disabled. Choose basic or verbose to capture new events.</div>
      )}

      {tab === "timeline" ? (
        <div className="ab-drawer__body">
          {latest.map((r) => (
            <article key={r.id} className="ab-drawer__event">
              <div className="ab-drawer__event-meta">
                <span className="ab-drawer__event-time">{new Date(r.at).toLocaleTimeString()}</span>
                {r.agent && <span className="ab-drawer__event-agent">{r.agent}</span>}
              </div>
              <div
                className={`ab-drawer__event-title ${
                  r.severity === "error" ? "ab-drawer__event-title--error" : r.severity === "warn" ? "ab-drawer__event-title--warn" : ""
                }`}
              >
                {r.title}
              </div>
              {r.details && <pre className="ab-drawer__event-details">{JSON.stringify(r.details, null, 2)}</pre>}
            </article>
          ))}
          {latest.length === 0 && <div className="ab-testchat__empty">No telemetry yet.</div>}
        </div>
      ) : (
        <div className="ab-drawer__body">
          <pre className="ab-drawer__raw">{JSON.stringify(latest, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
