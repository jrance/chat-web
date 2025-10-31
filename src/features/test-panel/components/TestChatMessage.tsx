import React from "react";
import { WidgetHost } from "../../../lib/widgets/host";
import { ChatMessage } from "../../../lib/orch/types";

export default function TestChatMessage({ m }: { m: ChatMessage }) {
  return (
    <article className={`ab-msg ab-msg--${m.role}`}>
      <header className="ab-msg__role">{m.role}</header>
      <div className="ab-msg__content">
        {m.text && <p>{m.text}</p>}
        {m.widgets && m.widgets.length > 0 && (
          <div className="ab-msg__widgets">
            <WidgetHost envelopes={m.widgets} />
          </div>
        )}
        {m.role === "tool" && m.tool && (
          <div className="ab-msg__tool">
            <WidgetHost
              envelopes={[{ kind: "tool-result", props: { name: m.tool.name, details: m.tool.result } }]}
            />
          </div>
        )}
      </div>
    </article>
  );
}
