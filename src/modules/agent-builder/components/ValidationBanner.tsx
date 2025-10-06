import { useMemo } from "react";
import { useValidation } from "../hooks/useValidation";
import { useAgentBuilder } from "../store/AgentBuilderContext";

export function ValidationBanner(): JSX.Element {
  const { state } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const issues = useMemo(() => computeIssues(state.ir), [state.ir, computeIssues]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const ok = errors.length === 0;

  return (
    <div className={`ab-validation ${ok ? "ab-validation--ok" : "ab-validation--err"}`} title={ok ? "Graph is valid" : `${errors.length} errors, ${warnings.length} warnings`}>
      {ok ? "Valid" : `Errors: ${errors.length}  •  Warnings: ${warnings.length}`}
      {!ok && (
        <div className="ab-validation__dropdown">
          <ul>
            {issues.map((i, idx) => (
              <li key={idx}>{i.severity === "warning" ? "⚠️" : "⛔"} {i.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
