import { useState } from "react";
import type { HitlMeta, ResumePayload } from "../../../lib/orch/types";

type Props = {
  hitl: HitlMeta;
  onResume: (payload: ResumePayload) => void;
  busy?: boolean;
};

export default function ResumeBar({ hitl, onResume, busy }: Props) {
  const [msg, setMsg] = useState("");

  const hasRouter = (hitl as any)?.kind === "router_choice" || (hitl as any)?.targets;
  const hasClarify = (hitl as any)?.kind === "user_message" || (hitl as any)?.placeholder || (hitl as any)?.message;

  return (
    <div className="border-t border-neutral-800 p-2 bg-neutral-950">
      {hasRouter && (
        <div className="mb-2 flex flex-wrap gap-2">
          {(hitl as any).targets?.map((t: any) => (
            <button
              key={t.id}
              disabled={busy}
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onResume({ kind: "router_choice", choice: { target: t.id } })}
            >
              {t.label || t.id}
            </button>
          ))}
        </div>
      )}
      {hasClarify && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={(hitl as any)?.placeholder || (hitl as any)?.message || "Add clarification..."}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            disabled={busy}
            aria-label="Clarification message"
          />
          <button
            onClick={() => onResume({ kind: "user_message", message: msg })}
            className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={busy || !msg.trim()}
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
