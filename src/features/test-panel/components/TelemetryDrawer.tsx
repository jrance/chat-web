import { useMemo, useState } from "react";
import type { TelemetryRow } from "../../../lib/orch/telemetry";

export default function TelemetryDrawer({ rows }: { rows: TelemetryRow[] }) {
  const [tab, setTab] = useState<"timeline" | "raw">("timeline");
  const latest = useMemo(() => rows.slice(-200), [rows]); // bound size

  return (
    <div className="border-l border-neutral-800 bg-neutral-950 w-96 flex flex-col">
      <div className="flex items-center border-b border-neutral-800">
        <button
          onClick={() => setTab("timeline")}
          className={`px-3 py-2 text-sm ${tab === "timeline" ? "text-white" : "text-neutral-400"}`}
        >
          Timeline
        </button>
        <button
          onClick={() => setTab("raw")}
          className={`px-3 py-2 text-sm ${tab === "raw" ? "text-white" : "text-neutral-400"}`}
        >
          Raw
        </button>
        <div className="ml-auto px-3 text-xs opacity-60">{latest.length}</div>
      </div>

      {tab === "timeline" ? (
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {latest.map((r) => (
            <div key={r.id} className="rounded border border-neutral-800 p-2 bg-neutral-900/40">
              <div className="text-xs opacity-60">{new Date(r.at).toLocaleTimeString()}</div>
              <div className="text-sm">
                <span
                  className={
                    r.severity === "error" ? "text-red-400" : r.severity === "warn" ? "text-yellow-300" : "text-neutral-100"
                  }
                >
                  {r.title}
                </span>
                {r.agent && <span className="opacity-60"> — {r.agent}</span>}
              </div>
              {r.details && (
                <pre className="mt-1 text-xs opacity-80 overflow-auto max-h-40">
                  {JSON.stringify(r.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-2">
          <pre className="text-xs">{JSON.stringify(latest, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
