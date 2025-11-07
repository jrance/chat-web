import React, { useMemo, useState } from "react";
import type { AgentNode, ToolRef } from "../../model/ir";
import type { ToolDef, ToolRegistry } from "../../model/tools";
import { ToolSchemaViewer } from "./ToolSchemaViewer";

type Props = {
  node: AgentNode;
  onChange: (next: AgentNode) => void;
  registry: ToolRegistry;
};

function matchesQuery(query: string, tool: ToolDef): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (tool.id.toLowerCase().includes(needle)) return true;
  if (tool.name.toLowerCase().includes(needle)) return true;
  return (tool.tags ?? []).some((tag) => tag.toLowerCase().includes(needle));
}

export const AgentToolsPicker: React.FC<Props> = ({ node, onChange, registry }) => {
  const [query, setQuery] = useState("");
  const tools = useMemo(() => registry.list().filter((tool) => matchesQuery(query, tool)), [registry, query]);
  const selected = new Map((node.config?.allowedTools ?? []).map((tool) => [tool.toolId, tool.variantId ?? null]));

  const updateAllowedTools = (next: ToolRef[]) => {
    onChange({
      ...node,
      config: {
        ...(node.config ?? {}),
        allowedTools: next,
      },
    });
  };

  const toggleTool = (toolId: string) => {
    const current = node.config?.allowedTools ?? [];
    const exists = current.some((tool) => tool.toolId === toolId);
    const next = exists ? current.filter((tool) => tool.toolId !== toolId) : [...current, { toolId }];
    updateAllowedTools(next);
  };

  const setVariant = (toolId: string, variantId: string | undefined) => {
    const current = node.config?.allowedTools ?? [];
    const next = current.map((tool) => (tool.toolId === toolId ? { ...tool, variantId } : tool));
    updateAllowedTools(next);
  };

  return (
    <div className="ab-tools-picker">
      <div className="ab-tools-search">
        <input className="ab-input" placeholder="Search tools..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <ul className="ab-tools-list">
        {tools.map((tool) => {
          const isSelected = selected.has(tool.id);
          const variantId = selected.get(tool.id) ?? undefined;
          const variant = tool.variants?.find((v) => v.id === variantId) ?? null;
          const selectId = `tool-variant-${tool.id}`;
          return (
            <li key={tool.id} className={`ab-tool ${isSelected ? "is-selected" : ""}`}>
              <div className="ab-tool-head">
                <label className="ab-checkline">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleTool(tool.id)} />
                  <span className="ab-tool-title">{tool.name}</span>
                  <code className="ab-tool-id">{tool.id}</code>
                </label>
                <span className="ab-chip">{tool.runtime}</span>
              </div>
              <div className="ab-tool-desc">{tool.description}</div>
              {tool.variants && tool.variants.length > 0 && isSelected && (
                <div className="ab-field">
                  <label className="ab-label" htmlFor={selectId}>
                    Variant
                  </label>
                  <select id={selectId} className="ab-select" value={variantId ?? ""} onChange={(event) => setVariant(tool.id, event.target.value || undefined)}>
                    <option value="">(default)</option>
                    {tool.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <ToolSchemaViewer tool={tool} variant={variant ?? undefined} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
