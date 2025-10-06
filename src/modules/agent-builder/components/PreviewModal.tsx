import { useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";

export function PreviewModal(): JSX.Element | null {
  const { state } = useAgentBuilder();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  if (!open) {
    return (
      <button className="ab-preview-open ab-btn ab-btn--outline" onClick={() => setOpen(true)}>
        Preview run
      </button>
    );
  }

  const plan = computePlan(state.ir);

  return (
    <div className="ab-modal" role="dialog" aria-modal="true" aria-label="Preview Run">
      <div className="ab-modal__content">
        <header className="ab-modal__header">
          <h3>Preview run</h3>
          <button onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </header>
        <div className="ab-modal__body">
          <label className="ab-field">
            <span>Sample prompt</span>
            <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <div className="ab-preview__section">
            <h4>Execution order</h4>
            <ol>
              {plan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function computePlan(ir: any): string[] {
  // Extremely simplified dry-run plan: list nodes by insertion order
  return ir.nodes.map((n: any) => `${n.kind}: ${n.label}`);
}
