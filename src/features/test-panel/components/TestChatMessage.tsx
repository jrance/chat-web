import React from "react";
import { WidgetHost } from "../../../lib/widgets/host";
import { ChatMessage } from "../../../lib/orch/types";

const ROLE_LABELS: Record<string, { label: string; initials: string }> = {
  user: { label: "You", initials: "You" },
  assistant: { label: "Assistant", initials: "AI" },
  system: { label: "System", initials: "SYS" },
  tool: { label: "Tool", initials: "TL" },
};

function resolveRoleMeta(role: ChatMessage["role"]) {
  const base = ROLE_LABELS[role] || { label: role, initials: role.slice(0, 2).toUpperCase() };
  return base;
}

export default function TestChatMessage({ m }: { m: ChatMessage }) {
  const { label, initials } = resolveRoleMeta(m.role);
  const bubbleClasses = ["ab-msg__bubble"];

  if (m.role === "tool") {
    bubbleClasses.push("ab-msg__bubble--tool");
  } else if (m.role === "system") {
    bubbleClasses.push("ab-msg__bubble--system");
  }

  return (
    <article className={`ab-msg ab-msg--${m.role}`}>
      <div className="ab-msg__avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="ab-msg__body">
        <header className="ab-msg__meta">
          <span className="ab-msg__role">{label}</span>
        </header>
        {m.text && (
          <div className={bubbleClasses.join(" ")}>
            <p>{m.text}</p>
          </div>
        )}
        {m.widgets && m.widgets.length > 0 && (
          <div className="ab-msg__bubble ab-msg__bubble--widget ab-msg__widgets">
            <WidgetHost envelopes={m.widgets} />
          </div>
        )}
        {m.role === "tool" && m.tool && (
          <div className="ab-msg__bubble ab-msg__bubble--tool ab-msg__tool">
            <div className="ab-msg__tool-name">{m.tool.name}</div>
            <WidgetHost envelopes={[{ kind: "tool-result", props: { name: m.tool.name, details: m.tool.result } }]} />
          </div>
        )}
      </div>
    </article>
  );
}
