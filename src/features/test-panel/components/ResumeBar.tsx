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
    <div className="ab-resume" role="region" aria-live="polite">
      {hasRouter && (
        <div className="ab-resume__targets">
          {(hitl as any).targets?.map((t: any) => (
            <button
              key={t.id}
              disabled={busy}
              className="ab-resume__choice"
              onClick={() => onResume({ kind: "router_choice", choice: { target: t.id } })}
            >
              {t.label || t.id}
            </button>
          ))}
        </div>
      )}
      {hasClarify && (
        <div className="ab-resume__clarify">
          <input
            className="ab-resume__clarify-input"
            placeholder={(hitl as any)?.placeholder || (hitl as any)?.message || "Add clarification..."}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            disabled={busy}
            aria-label="Clarification message"
          />
          <button
            onClick={() => onResume({ kind: "user_message", message: msg })}
            className="ab-resume__submit"
            disabled={busy || !msg.trim()}
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
