import React, { useMemo, useState } from "react";
import { listTools, getToolById } from "../../lib/tools/registry";
import type { AgentToolBinding, ToolOverrides, Visibility } from "../../lib/tools/shapes";
import ArgEditor from "./fields/ArgEditor";
import { readAgentToolsFromIR, writeAgentToolsToIR } from "../../lib/orch/ir/transform";

type Props = {
  graph: { nodes: any[] };
  selectedNodeId: string;
  onGraphChange: (next: { nodes: any[] }) => void;
};

export default function ToolConfigPanel({ graph, selectedNodeId, onGraphChange }: Props) {
  const node = graph.nodes.find(n => n.id === selectedNodeId);
  const isAgent = node?.kind === "agent.codeless";
  const [bindings, setBindings] = useState<AgentToolBinding[]>(() => isAgent ? readAgentToolsFromIR(node, graph.nodes) : []);

  const allTools = useMemo(() => listTools(), []);

  if (!isAgent) return <div className="text-sm opacity-60 p-2">Select a Codeless Agent to configure tools.</div>;

  const updateBinding = (toolNodeId: string, draft: Partial<AgentToolBinding>) => {
    setBindings(prev => prev.map(b => b.toolNodeId === toolNodeId ? { ...b, ...draft } : b));
  };

  const addTool = (toolId: string) => {
    const meta = getToolById(toolId);
    if (!meta) return;
    const toolNodeId = crypto.randomUUID();
    const overrides: ToolOverrides = {};
    for (const def of meta.argsSchema) {
      const vis: Visibility = (def as any).visibility || "Normal";
      const defVal = meta.defaults ? meta.defaults[def.name] : undefined;
      overrides[def.name] = { value: defVal, visibility: vis };
    }
    setBindings(prev => [...prev, { toolNodeId, toolId, overrides }]);
  };

  const removeTool = (toolNodeId: string) => {
    setBindings(prev => prev.filter(b => b.toolNodeId !== toolNodeId));
  };

  const save = () => {
    const { node: nextNode, nodes: nextNodes } = writeAgentToolsToIR(node, graph.nodes, bindings);
    onGraphChange({ nodes: nextNodes.map(n => n.id === nextNode.id ? nextNode : n) });
  };

  const policy = node?.data?.tools || {};
  const setPolicy = (key: string, val: any) => {
    const nextNode = {
      ...node,
      data: { ...node.data, tools: { ...(node.data?.tools || {}), [key]: val } }
    };
    const nextNodes = graph.nodes.map(n => n.id === nextNode.id ? nextNode : n);
    onGraphChange({ nodes: nextNodes });
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-2">
        <div className="text-xs uppercase opacity-70">Tool policy</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Policy
            <select className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.policy || "Auto"} onChange={e => setPolicy("policy", e.target.value)}>
              <option>Disabled</option><option>Auto</option><option>AlwaysAsk</option><option>Heuristic</option>
            </select>
          </label>
          <label className="text-sm">Timeout (ms)
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.timeoutMs ?? 10000} onChange={e => setPolicy("timeoutMs", Number(e.target.value))} />
          </label>
          <label className="text-sm">Max calls/turn
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.maxCallsPerTurn ?? 0} onChange={e => setPolicy("maxCallsPerTurn", Number(e.target.value))} />
          </label>
          <label className="text-sm">Parallelism
            <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-2 py-1"
              value={policy.parallelism ?? 1} onChange={e => setPolicy("parallelism", Number(e.target.value))} />
          </label>
          <label className="text-sm inline-flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={!!policy.redactPII} onChange={e => setPolicy("redactPII", e.target.checked)} />
            Redact PII in telemetry and tool payload samples
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase opacity-70">Attached tools</div>
        <div className="flex gap-2">
          <select className="bg-neutral-900 text-neutral-50 rounded px-2 py-1"
                  onChange={(e) => { if (e.target.value) { addTool(e.target.value); e.target.value=""; } }}>
            <option value="">+ Add tool…</option>
            {allTools.map(t => <option key={t.toolId} value={t.toolId}>{t.name}</option>)}
          </select>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={save}>Save</button>
        </div>

        <div className="space-y-3">
          {bindings.map(b => {
            const meta = getToolById(b.toolId);
            if (!meta) return null;
            return (
              <div key={b.toolNodeId} className="rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm">{meta.name} <span className="opacity-60">({meta.version})</span></div>
                  <button className="ml-auto text-xs px-2 py-1 rounded bg-neutral-800" onClick={() => removeTool(b.toolNodeId)}>Remove</button>
                </div>
                <div className="grid gap-3">
                  {meta.argsSchema.map((def, i) => (
                    <ArgEditor key={i}
                      schema={def}
                      value={b.overrides[def.name]?.value}
                      visibility={b.overrides[def.name]?.visibility || (def as any).visibility || "Normal"}
                      onChange={(v:any) => updateBinding(b.toolNodeId, {
                        overrides: { ...b.overrides, [def.name]: { value: v, visibility: b.overrides[def.name]?.visibility || (def as any).visibility || "Normal" } }
                      })}
                      onVisibilityChange={(vis:any) => updateBinding(b.toolNodeId, {
                        overrides: { ...b.overrides, [def.name]: { value: b.overrides[def.name]?.value, visibility: vis } }
                      })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs opacity-70">
        <p className="mb-1"><strong>LLMHidden</strong>: not included in the tool schema sent to the model; injected at execution time.</p>
        <p><strong>AgentOverride</strong>: included in the schema but overwritten before executing the tool.</p>
      </div>
    </div>
  );
}
