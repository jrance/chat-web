import { AGENT_KINDS, ORCHESTRATION_KINDS, TOOL_KINDS, INTEGRATION_KINDS } from "../model/nodeTypes";

const categories = [
  { title: "Orchestration", kinds: ORCHESTRATION_KINDS },
  { title: "Agent", kinds: AGENT_KINDS },
  { title: "Tool", kinds: TOOL_KINDS },
  { title: "Integrations", kinds: INTEGRATION_KINDS },
];

export function Palette(): JSX.Element {
  return (
    <aside className="ab-palette" aria-label="Node Library">
      {categories.map((cat) => (
        <section key={cat.title} className="ab-palette__section">
          <h3>{cat.title}</h3>
          <ul>
            {cat.kinds.map((k) => (
              <li key={k}>
                <button
                  className={`ab-palette__item ab-palette__item--${k.replace(/\./g, "-")}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-agentbuilder-kind", k);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  {labelForKind(k)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}

function labelForKind(kind: string) {
  switch (kind) {
    case "router":
      return "Router (Handoff)";
    case "sequential":
      return "Sequential";
    case "concurrent":
      return "Concurrent";
    case "groupchat":
      return "GroupChat";
    case "output":
      return "Output";
    case "agent.codeless":
      return "Codeless Agent";
    case "agent.byoe":
      return "BYOE Agent";
    case "agent.remote":
      return "Remote (A2A) Agent";
    case "tool":
      return "Tool";
    case "mcpServer":
      return "MCP Server";
    default:
      return kind;
  }
}
