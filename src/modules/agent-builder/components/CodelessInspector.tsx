import { useMemo, useState } from "react";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { useValidation } from "../hooks/useValidation";
import AutoTextarea from "./AutoTextarea";
import { useToolsCatalog } from "../hooks/useToolsCatalog";
import { useTool } from "../hooks/useTool";

export default function CodelessInspector({ nodeId }: { nodeId: string }) {
  const { state, dispatch } = useAgentBuilder();
  const { computeIssues } = useValidation();
  const node = state.ir.nodes.find((n) => n.id === nodeId && n.kind === "agent.codeless") as any;
  const [tab, setTab] = useState<"Basics" | "Instructions" | "Model" | "Context" | "Tools" | "Structured" | "Safety" | "Telemetry" | "Validation">("Basics");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [paramDrawer, setParamDrawer] = useState<{ open: boolean; toolId?: string }>({ open: false });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSelectedId, setCatalogSelectedId] = useState<string | undefined>(undefined);
  const { items: catalogAll } = useToolsCatalog();
  const { items: catalogFiltered } = useToolsCatalog(catalogQuery ? { search: catalogQuery } : undefined);
  if (!node) return null;

  const issues = computeIssues(state.ir).filter((i) => i.path.includes(`/nodes/${nodeId}`));

  const update = (patch: any) => {
    const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
    dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
  };

  function presetFromMs(ms?: number): string {
    switch (ms) {
      case 5 * 60 * 1000: return "5m";
      case 15 * 60 * 1000: return "15m";
      case 30 * 60 * 1000: return "30m";
      case 60 * 60 * 1000: return "1h";
      case 3 * 60 * 60 * 1000: return "3h";
      case 24 * 60 * 60 * 1000: return "24h";
      default: return "custom";
    }
  }
  function presetToMs(v: string): number | undefined {
    switch (v) {
      case "5m": return 5 * 60 * 1000;
      case "15m": return 15 * 60 * 1000;
      case "30m": return 30 * 60 * 1000;
      case "1h": return 60 * 60 * 1000;
      case "3h": return 3 * 60 * 60 * 1000;
      case "24h": return 24 * 60 * 60 * 1000;
      default: return undefined;
    }
  }

  return (
    <div>
      <div className="ab-tabs" role="tablist" aria-label="Codeless agent inspector tabs">
        {(["Basics", "Instructions", "Model", "Context", "Tools", "Structured", "Safety", "Telemetry", "Validation"] as const).map((t) => (
          <button key={t} className={`ab-tab ${tab === t ? "ab-tab--active" : ""}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Basics" && (
        <div className="ab-inspector__section">
          <h3>Basics</h3>
          <label className="ab-field ab-field--stack">
            <span>Label</span>
            <input value={node.label} onChange={(e) => dispatch({ type: "UPDATE_NODE_LABEL", id: nodeId, label: e.target.value })} />
            <div className="ab-help">Name shown on canvas and used in routes.</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Description</span>
            <AutoTextarea value={node.description || ""} onChange={(val) => {
              const nodes = state.ir.nodes.map((n) => (n.id === nodeId ? { ...n, description: val } : n));
              dispatch({ type: "SET_GRAPH", ir: { ...state.ir, nodes } });
            }} minRows={3} />
            <div className="ab-help">Optional; helps collaborators understand the agent.</div>
          </label>
        </div>
      )}

      {tab === "Instructions" && (
        <div className="ab-inspector__section">
          <h3>Instructions</h3>
          <label className="ab-field ab-field--stack">
            <span>System Instructions</span>
            <AutoTextarea value={node.data.systemInstructions || ""} onChange={(val) => update({ systemInstructions: val })} minRows={5} />
            <div className="ab-help">Describe the assistant's role and constraints. E.g., write clearly and cite sources if available.</div>
          </label>
          <label className="ab-field ab-field--stack">
            <span>Style Guide</span>
            <AutoTextarea value={node.data.styleGuide || ""} onChange={(val) => update({ styleGuide: val })} minRows={3} />
            <div className="ab-help">Tone/format guidance (e.g., enterprise, concise, bulleted).</div>
          </label>
        </div>
      )}

      {tab === "Model" && (
        <div className="ab-inspector__section">
          <h3>Model / Inference</h3>
          <label className="ab-field ab-field--stack"><span>Provider</span>
            <select value={node.data.model?.provider || "openai"} onChange={(e) => update({ model: { ...node.data.model, provider: e.target.value } })}>
              {(["openai", "azureopenai", "bedrock", "ollama", "other"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="ab-help">Choose a model provider; runtime must support it.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Model ID</span>
            <input value={node.data.model?.modelId || ""} onChange={(e) => update({ model: { ...node.data.model, modelId: e.target.value } })} />
            <div className="ab-help">Exact model name, e.g., gpt-4o, llama3:instruct.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Temperature</span>
            <input type="number" step={0.01} min={0} max={2} value={node.data.model?.temperature ?? 0.3} onChange={(e) => update({ model: { ...node.data.model, temperature: Number(e.target.value) } })} />
            <div className="ab-help">Higher = more creative; 0–2. Default 0.3.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>TopP</span>
            <input type="number" step={0.01} min={0.01} max={1} value={node.data.model?.topP ?? 1} onChange={(e) => update({ model: { ...node.data.model, topP: Number(e.target.value) } })} />
            <div className="ab-help">Nucleus sampling; (0,1]. Default 1.0.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Max Tokens</span>
            <input type="number" min={1} value={node.data.model?.maxTokens ?? 800} onChange={(e) => update({ model: { ...node.data.model, maxTokens: Number(e.target.value) } })} />
            <div className="ab-help">Upper bound for output tokens. Default 800.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Seed</span>
            <input type="number" value={node.data.model?.seed ?? ""} onChange={(e) => update({ model: { ...node.data.model, seed: e.target.value === "" ? null : Number(e.target.value) } })} />
            <div className="ab-help">Optional reproducibility control; may not be supported by all providers.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Stop</span>
            <input placeholder="comma,separated" value={(node.data.model?.stop || []).join(",")} onChange={(e) => update({ model: { ...node.data.model, stop: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) } })} />
            <div className="ab-help">Optional stop sequences; include without quotes, comma separated.</div>
          </label>
          <label className="ab-field ab-field--check"><span>JSON Mode</span>
            <input type="checkbox" checked={Boolean(node.data.model?.jsonModeEnabled)} onChange={(e) => { update({ model: { ...node.data.model, jsonModeEnabled: e.target.checked } }); if (e.target.checked) setTab("Structured"); }} />
            <div className="ab-help">Force strict JSON responses when enabled (provider support varies).</div>
          </label>
        </div>
      )}

      {tab === "Context" && (
        <div className="ab-inspector__section">
          <h3>Context & Memory</h3>
          <label className="ab-field ab-field--stack"><span>History</span>
            <select value={node.data.context?.historyWindow?.mode || "LastN"} onChange={(e) => update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), mode: e.target.value } } })}>
              <option value="None">None</option>
              <option value="LastN">LastN</option>
              <option value="TimeBounded">TimeBounded</option>
            </select>
            <div className="ab-help">Choose how much chat history to include.</div>
          </label>
          {(node.data.context?.historyWindow?.mode || "LastN") === "LastN" && (
            <label className="ab-field ab-field--stack"><span>N</span>
              <input type="number" min={0} value={node.data.context?.historyWindow?.n ?? 10} onChange={(e) => update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), n: Number(e.target.value) } } })} />
              <div className="ab-help">When History=LastN, include this many previous messages.</div>
            </label>
          )}
          {(node.data.context?.historyWindow?.mode || "LastN") === "TimeBounded" && (
            <>
              <label className="ab-field ab-field--stack"><span>Duration</span>
                <select value={presetFromMs(node.data.context?.historyWindow?.durationMs)} onChange={(e) => { const v = e.target.value; if (v === "custom") { update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), durationMs: undefined } } }); return; } const ms = presetToMs(v); update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), durationMs: ms } } }); }}>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h</option>
                  <option value="3h">3h</option>
                  <option value="24h">24h</option>
                  <option value="custom">Custom…</option>
                </select>
                <div className="ab-help">Include messages within this relative window up to now.</div>
              </label>
              {presetFromMs(node.data.context?.historyWindow?.durationMs) === "custom" && (
                <label className="ab-field"><span>Custom</span>
                  <div className="ab-duo">
                    <div className="ab-duo__col"><div className="ab-duo__label">Hours</div>
                      <input type="number" min={0} value={Math.floor(((node.data.context?.historyWindow?.durationMs ?? 0) / 3600000) || 0)} onChange={(e) => { const hours = Number(e.target.value) || 0; const minutes = Math.floor((((node.data.context?.historyWindow?.durationMs ?? 0) % 3600000) / 60000) || 0); const ms = Math.max(0, hours * 3600000 + minutes * 60000); update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), durationMs: ms } } }); }} />
                    </div>
                    <div className="ab-duo__col"><div className="ab-duo__label">Minutes</div>
                      <input type="number" min={0} max={59} value={Math.floor((((node.data.context?.historyWindow?.durationMs ?? 0) % 3600000) / 60000) || 0)} onChange={(e) => { let minutes = Number(e.target.value) || 0; minutes = Math.min(59, Math.max(0, minutes)); const hours = Math.floor(((node.data.context?.historyWindow?.durationMs ?? 0) / 3600000) || 0); const ms = Math.max(0, hours * 3600000 + minutes * 60000); update({ context: { ...node.data.context, historyWindow: { ...(node.data.context?.historyWindow || {}), durationMs: ms } } }); }} />
                    </div>
                  </div>
                  <div className="ab-help">If Custom, specify hours and minutes.</div>
                </label>
              )}
            </>
          )}
          <label className="ab-field ab-field--check"><span>Inject Preamble</span>
            <input type="checkbox" checked={Boolean(node.data.context?.injectOrgPreamble)} onChange={(e) => update({ context: { ...node.data.context, injectOrgPreamble: e.target.checked } })} />
            <div className="ab-help">Prepend organization policy/brand preamble, if configured.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Context Vars (JSON)</span>
            <AutoTextarea value={JSON.stringify(node.data.context?.vars || {}, null, 2)} onChange={(val) => { try { update({ context: { ...node.data.context, vars: JSON.parse(val) } }); } catch {} }} minRows={4} />
            <div className="ab-help">Static variables injected into prompts (e.g., tenantId, locale).</div>
          </label>
        </div>
      )}

      {tab === "Tools" && (
        <div className="ab-inspector__section">
          <h3>Tools</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", gap: "0.5rem", alignItems: "center" }}>
            <div className="ab-hint">Attach tools from the Tenant Catalog and configure per-agent overrides.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label className="ab-topbar__toggle">
                <input
                  type="checkbox"
                  checked={Boolean(state.ir.meta?.metadata && (state.ir.meta.metadata as any).showToolNodesOnCanvas)}
                  onChange={(e) => {
                    const ir = { ...state.ir, meta: { ...state.ir.meta, metadata: { ...(state.ir.meta.metadata || {}), showToolNodesOnCanvas: e.target.checked } } };
                    dispatch({ type: "SET_GRAPH", ir });
                  }}
                />
                Show tool nodes on canvas
              </label>
              <button className="ab-btn ab-btn--secondary" onClick={() => setCatalogOpen(true)}>Add from Catalog</button>
            </div>
          </div>
          <div>
            <h4 style={{ margin: "0.5rem 0" }}>Attached</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
              {(node.data.tools?.bindings || []).map((b: any, idx: number) => {
                const def = catalogAll.find((t) => t.id === b.toolId);
                const title = def ? `${def.name} (${b.version || def.version})` : b.toolId;
                const overridesCount = b.parameterOverrides ? Object.keys(b.parameterOverrides).length : 0;
                const thisPath = `/nodes/${nodeId}/data/tools/bindings/${b.toolId}`;
                const bindingIssues = issues.filter((i) => i.path.startsWith(thisPath));
                const hasErr = bindingIssues.some((i) => i.severity === "error");
                const hasWarn = !hasErr && bindingIssues.some((i) => i.severity === "warning");
                const statusClass = hasErr ? "ab-status--error" : hasWarn ? "ab-status--warn" : "ab-status--ok";
                return (
                  <li key={idx} style={{ border: "1px solid #3f4149", borderRadius: 6, padding: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong>{title}</strong>
                        {def?.auth?.type && <span className="ab-chip">{def.auth.type}</span>}
                        {def?.status && <span className="ab-chip">{def.status}</span>}
                        <span className={`ab-status ${statusClass}`} title={bindingIssues.map((i) => i.message).join("; ")}></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span className="ab-chip" style={{ cursor: "pointer" }} onClick={() => setParamDrawer({ open: true, toolId: b.toolId })}>Overrides: {overridesCount}</span>
                        <button className="ab-btn ab-btn--outline" onClick={() => setExpanded((prev) => ({ ...prev, [b.toolId]: !prev[b.toolId] }))}>{expanded[b.toolId] ? "Collapse" : "Edit"}</button>
                        <button className="ab-btn ab-btn--outline" onClick={() => { const next = (node.data.tools?.bindings || []).filter((x: any) => x !== b); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }}>Remove</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <label className="ab-field ab-field--stack"><span>Policy</span>
                        <select value={b.policy || "Disabled"} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, policy: e.target.value } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }}>
                          <option>Disabled</option><option>Auto</option><option>AlwaysAsk</option><option>Heuristic</option>
                        </select>
                      </label>
                      <label className="ab-field ab-field--stack"><span>Timeout (ms)</span>
                        <input type="number" min={0} value={b.timeoutMs ?? 10000} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, timeoutMs: Number(e.target.value) } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                      </label>
                      <label className="ab-field ab-field--stack"><span>Max Calls</span>
                        <input type="number" min={0} value={b.maxCallsPerTurn ?? 0} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, maxCallsPerTurn: Number(e.target.value) } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                      </label>
                      <label className="ab-field ab-field--stack"><span>Parallelism</span>
                        <input type="number" min={1} value={b.parallelism ?? 1} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, parallelism: Number(e.target.value) } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                      </label>
                    </div>
                    {b.policy === "Heuristic" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <label className="ab-field ab-field--stack"><span>Keywords</span>
                          <input value={(b.heuristic?.keywords || []).join(", ")} onChange={(e) => { const val = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, heuristic: { ...(b.heuristic || {}), keywords: val } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                        </label>
                        <label className="ab-field ab-field--stack"><span>Regex</span>
                          <input value={b.heuristic?.regex || ""} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, heuristic: { ...(b.heuristic || {}), regex: e.target.value } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                        </label>
                        <label className="ab-field ab-field--check"><span>Case Sensitive</span>
                          <input type="checkbox" checked={Boolean(b.heuristic?.caseSensitive)} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, heuristic: { ...(b.heuristic || {}), caseSensitive: e.target.checked } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                        </label>
                      </div>
                    )}

                    {expanded[b.toolId] && (
                      <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.75rem" }}>
                        {/* Overview */}
                        <div>
                          <h4>Overview</h4>
                          <div className="ab-hint">Tool ID: {def?.id || b.toolId} • Owner: {def?.owner || "-"} • Category: {def?.category || "-"}</div>
                          {def?.description && <div className="ab-hint">{def.description}</div>}
                          {def?.metadata?.docsUrl && <a href={def.metadata.docsUrl} target="_blank" rel="noreferrer">Docs</a>}
                        </div>
                        {/* Retry */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                          <label className="ab-field ab-field--stack"><span>Retry: Max Attempts</span>
                            <input type="number" min={0} max={5} value={b.retry?.maxAttempts ?? 2} onChange={(e) => { const v = Number(e.target.value); const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, retry: { ...(b.retry || {}), maxAttempts: v } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                          </label>
                          <label className="ab-field ab-field--stack"><span>Backoff</span>
                            <select value={b.retry?.backoff || "exponential"} onChange={(e) => { const v = e.target.value; const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, retry: { ...(b.retry || {}), backoff: v } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }}>
                              <option value="none">None</option>
                              <option value="exponential">Exponential</option>
                              <option value="fixed">Fixed</option>
                            </select>
                          </label>
                          <label className="ab-field ab-field--stack"><span>Initial Delay (ms)</span>
                            <input type="number" min={0} value={b.retry?.initialDelayMs ?? 200} onChange={(e) => { const v = Number(e.target.value); const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, retry: { ...(b.retry || {}), initialDelayMs: v } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                          </label>
                        </div>
                        {/* Parameters table */}
                        {(() => {
                          const bindingIdx = (node.data.tools?.bindings || []).findIndex((x: any) => x === b);
                          const binding = (node.data.tools?.bindings || [])[bindingIdx];
                          const defParams = def?.parameters || [];
                          const onChange = (v: any, p: any) => {
                            const nextBindings = [...(node.data.tools?.bindings || [])];
                            const nb = { ...(nextBindings[bindingIdx] || {}) };
                            nb.parameterOverrides = { ...(nb.parameterOverrides || {}) };
                            if (v === "" || v === null || v === undefined) {
                              delete nb.parameterOverrides[p.name];
                            } else {
                              nb.parameterOverrides[p.name] = v;
                            }
                            nextBindings[bindingIdx] = nb;
                            update({ tools: { ...(node.data.tools || {}), bindings: nextBindings } });
                          };
                          const effectivePreview = defParams
                            .slice(0, 3)
                            .map((p: any) => `${p.name}=${JSON.stringify(binding?.parameterOverrides?.[p.name] ?? p.default)}`)
                            .join(", ");
                          return (
                            <div>
                              <h4>Parameters {effectivePreview && <span className="ab-chip">{effectivePreview}</span>}</h4>
                              <table className="ab-table" style={{ width: "100%" }}>
                                <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Override</th><th>Scope</th><th>Description</th></tr></thead>
                                <tbody>
                                  {defParams.map((p: any) => {
                                    const val = binding?.parameterOverrides?.[p.name] ?? p.default ?? "";
                                    return (
                                      <tr key={p.name}>
                                        <td>{p.name}</td>
                                        <td>{p.type}</td>
                                        <td>{String(p.default ?? "")}</td>
                                        <td>
                                          {p.scope === "OrgLocked" ? <span className="ab-hint">Org-locked</span> : p.type === "boolean" ? (
                                            <input type="checkbox" checked={Boolean(val)} onChange={(e) => onChange(e.target.checked, p)} />
                                          ) : p.type === "number" ? (
                                            <input type="number" min={p.min ?? undefined} max={p.max ?? undefined} value={val} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value), p)} />
                                          ) : p.type === "enum" ? (
                                            <select value={val} onChange={(e) => onChange(e.target.value, p)}>
                                              {(p.enum || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                          ) : (
                                            <input value={val} onChange={(e) => onChange(e.target.value, p)} />
                                          )}
                                        </td>
                                        <td>{p.scope}</td>
                                        <td>{p.description || ""}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                                <button className="ab-btn ab-btn--outline" onClick={() => { const nextBindings = [...(node.data.tools?.bindings || [])]; const nb = { ...binding, parameterOverrides: {} }; nextBindings[bindingIdx] = nb; update({ tools: { ...(node.data.tools || {}), bindings: nextBindings } }); }}>Reset to defaults</button>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Auth & Setup */}
                        {def?.auth?.type && def.auth.type !== "none" && (
                          <div>
                            <h4>Auth & Setup</h4>
                            {def && (["obo", "client_credentials"]).includes(String(def?.auth?.type || "").toLowerCase()) && (
                              <label className="ab-field ab-field--stack"><span>Scopes</span>
                                <input value={(b.authOverrides?.scopes || []).join(", ")} onChange={(e) => { const scopes = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, authOverrides: { ...(b.authOverrides || {}), scopes } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                              </label>
                            )}
                            {def && (["api_key", "client_credentials", "mtls"]).includes(String(def?.auth?.type || "").toLowerCase()) && (
                              <label className="ab-field ab-field--stack"><span>SecretRef</span>
                                <input value={b.authOverrides?.secretRef || ""} onChange={(e) => { const secretRef = e.target.value || null; const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, authOverrides: { ...(b.authOverrides || {}), secretRef } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} placeholder="tenant:secret/id" />
                              </label>
                            )}
                            <button className="ab-btn ab-btn--outline" onClick={() => alert("Validated (simulated)")}>Validate connection</button>
                          </div>
                        )}
                        {/* Transport */}
                        {def?.transport && (
                          <div>
                            <h4>Transport</h4>
                            <div className="ab-hint">Kind: {def.transport.kind}</div>
                            {def.transport.endpoint && <div className="ab-hint">Endpoint: {def.transport.endpoint}</div>}
                            {def.transport.responsePointer && <div className="ab-hint">Response pointer: {def.transport.responsePointer}</div>}
                          </div>
                        )}
                        {/* Privacy & Safety */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                          <label className="ab-field ab-field--check"><span>Redact PII</span>
                            <input type="checkbox" checked={b.privacy?.redactPII ?? true} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, privacy: { ...(b.privacy || {}), redactPII: e.target.checked } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                          </label>
                          <label className="ab-field ab-field--stack"><span>Redaction Profile</span>
                            <select value={b.privacy?.redactionProfile || "standard"} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, privacy: { ...(b.privacy || {}), redactionProfile: e.target.value } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }}>
                              <option value="standard">Standard</option>
                              <option value="strict">Strict</option>
                            </select>
                          </label>
                          <label className="ab-field ab-field--check"><span>Allow Raw Telemetry</span>
                            <input type="checkbox" checked={b.privacy?.allowRawTelemetry ?? false} onChange={(e) => { const next = (node.data.tools?.bindings || []).map((x: any) => x === b ? { ...x, privacy: { ...(b.privacy || {}), allowRawTelemetry: e.target.checked } } : x); update({ tools: { ...(node.data.tools || {}), bindings: next } }); }} />
                          </label>
                        </div>
                        {/* Validation list for this binding */}
                        {bindingIssues.length > 0 && (
                          <div>
                            <h4>Validation</h4>
                            <ul>
                              {bindingIssues.map((i, k) => <li key={k}>{i.severity === "warning" ? "??" : "?"} {i.message}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {(node.data.tools?.bindings || []).length === 0 && <li className="ab-inspector__placeholder">No tools attached</li>}
            </ul>
          </div>

          {catalogOpen && (
            <div className="ab-modal" role="dialog" aria-modal="true" aria-label="Tenant Tool Catalog" onClick={() => setCatalogOpen(false)}>
              <div className="ab-modal__content" onClick={(e) => e.stopPropagation()}>
                <div className="ab-modal__header"><h3>Tenant Tool Catalog</h3><button onClick={() => setCatalogOpen(false)} aria-label="Close">✕</button></div>
                <div className="ab-modal__body">
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input placeholder="Search name/id/owner/category" value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} style={{ width: "100%" }} />
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><th>Name</th><th>ID</th><th>Category</th><th>Owner</th><th>Auth</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                          {catalogFiltered.map((t) => (
                            <tr key={t.id} onClick={() => setCatalogSelectedId(t.id)} style={{ cursor: "pointer", background: catalogSelectedId === t.id ? "#2a2b36" : undefined }}>
                              <td>{(t.displayName || t.name)} (v{t.version})</td>
                              <td>{t.id}</td>
                              <td>{t.category}</td>
                              <td>{t.auth?.type}</td>
                              <td>{t.status}</td>
                              <td><button className="ab-btn ab-btn--primary" onClick={() => { const bindings = [...(node.data.tools?.bindings || [])]; if (!bindings.some((b: any) => b.toolId === t.id)) { bindings.push({ toolId: t.id, version: t.version, policy: "Auto", timeoutMs: t.transport?.timeoutMsDefault ?? 10000, maxCallsPerTurn: 1, parallelism: 1, retry: t.transport?.retry || { maxAttempts: 2, backoff: "exponential", initialDelayMs: 200 }, parameterOverrides: {} }); update({ tools: { ...(node.data.tools || {}), bindings } }); } setCatalogOpen(false); }}>Attach</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4>Details</h4>
                      {(() => {
                        const t = catalogAll.find((x) => x.id === catalogSelectedId);
                        if (!t) return (
                          <>
                            <div className="ab-hint">Select a tool to view details (parameters, schemas)</div>
                            <div className="ab-hint">Parameters preview is available after attaching via Overrides.</div>
                          </>
                        );
                        return (
                          <div style={{ display: "grid", gap: 6 }}>
                            <div className="ab-hint">{t.description}</div>
                            {t.metadata?.docsUrl && <a href={t.metadata.docsUrl} target="_blank" rel="noreferrer">Docs</a>}
                            {t.parameters && t.parameters.length > 0 && (
                              <div>
                                <div className="ab-json-editor__label">Parameters</div>
                                <ul className="ab-hint">
                                  {t.parameters.map((p) => <li key={p.name}>{p.name}: {p.type} (default {String(p.default ?? "")})</li>)}
                                </ul>
                              </div>
                            )}
                            {t.argsSchema && <div className="ab-hint">Args Schema present</div>}
                            {t.responseSchema && <div className="ab-hint">Response Schema present</div>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {paramDrawer.open && paramDrawer.toolId && (
            <div className="ab-modal" role="dialog" aria-modal="true" aria-label="Tool Parameters" onClick={() => setParamDrawer({ open: false })}>
              <div className="ab-modal__content" onClick={(e) => e.stopPropagation()}>
                <div className="ab-modal__header"><h3>Parameters</h3><button onClick={() => setParamDrawer({ open: false })} aria-label="Close">✕</button></div>
                <div className="ab-modal__body">
                  {(() => {
                    const { tool: def } = useTool(paramDrawer.toolId);
                    const bindingIdx = (node.data.tools?.bindings || []).findIndex((b: any) => b.toolId === paramDrawer.toolId);
                    if (!def || bindingIdx < 0) return <div className="ab-inspector__placeholder">Tool not found</div>;
                    const binding = (node.data.tools?.bindings || [])[bindingIdx];
                    const params = def.parameters || [];
                    return (
                      <div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Value</th><th>Scope</th><th>Description</th></tr></thead>
                          <tbody>
                            {params.map((p) => {
                              const isLocked = p.scope === "OrgLocked";
                              const val = binding.parameterOverrides?.[p.name] ?? p.default ?? "";
                              const onChange = (v: any) => {
                                const nextBindings = [...(node.data.tools?.bindings || [])];
                                const nb = { ...binding };
                                nb.parameterOverrides = { ...(nb.parameterOverrides || {}) };
                                if (v === "" || v === null || v === undefined) { delete nb.parameterOverrides[p.name]; } else { nb.parameterOverrides[p.name] = v; }
                                nextBindings[bindingIdx] = nb;
                                update({ tools: { ...(node.data.tools || {}), bindings: nextBindings } });
                              };
                              return (
                                <tr key={p.name}>
                                  <td>{p.name}</td>
                                  <td>{p.type}{p.type === "enum" && p.enum ? `(${p.enum.join("|")})` : ""}</td>
                                  <td>{String(p.default ?? "")}</td>
                                  <td>
                                    {isLocked ? <span className="ab-hint">Org-locked</span> : p.type === "boolean" ? (
                                      <input type="checkbox" checked={Boolean(val)} onChange={(e) => onChange(e.target.checked)} />
                                    ) : p.type === "number" ? (
                                      <input type="number" min={p.min ?? undefined} max={p.max ?? undefined} value={val} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
                                    ) : p.type === "enum" ? (
                                      <select value={val} onChange={(e) => onChange(e.target.value)}>
                                        {(p.enum || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                      </select>
                                    ) : (
                                      <input value={val} onChange={(e) => onChange(e.target.value)} />
                                    )}
                                  </td>
                                  <td>{p.scope}</td>
                                  <td>{p.description || ""}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                          <button className="ab-btn ab-btn--outline" onClick={() => { const nextBindings = [...(node.data.tools?.bindings || [])]; const nb = { ...binding, parameterOverrides: {} }; nextBindings[bindingIdx] = nb; update({ tools: { ...(node.data.tools || {}), bindings: nextBindings } }); }}>Reset to defaults</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Structured" && (
        <div className="ab-inspector__section ab-inspector__section--grow">
          <h3>Structured Output</h3>
          <label className="ab-field ab-field--check"><span>Enabled</span>
            <input type="checkbox" checked={Boolean(node.data.structuredOutput?.enabled)} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), enabled: e.target.checked } })} />
            <div className="ab-help">Enforce schema with JSON mode or instruction-based repair.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>On Violation</span>
            <select value={node.data.structuredOutput?.onViolation || "RetryAndRepair"} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), onViolation: e.target.value } })}>
              <option>RetryAndRepair</option><option>ReturnError</option><option>BestEffort</option>
            </select>
            <div className="ab-help">Choose behavior when output fails schema validation.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Max Repairs</span>
            <input type="number" min={0} value={node.data.structuredOutput?.maxRepairAttempts ?? 2} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), maxRepairAttempts: Number(e.target.value) } })} />
            <div className="ab-help">Limit retries during repair loop.</div>
          </label>
          <div className="ab-json-editor">
            <div className="ab-json-editor__label">Output Schema (JSON)</div>
            <AutoTextarea className="ab-json-textarea" value={JSON.stringify(node.data.structuredOutput?.schema || {}, null, 2)} onChange={(val) => { try { update({ structuredOutput: { ...(node.data.structuredOutput || {}), schema: JSON.parse(val) } }); } catch {} }} expandWithinParent minRows={8} />
          </div>
          <div className="ab-hint">
            Post-processor:
            <label style={{ marginLeft: 8 }}><input type="checkbox" checked={Boolean(node.data.structuredOutput?.postProcess?.normalizeWhitespace)} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), postProcess: { ...(node.data.structuredOutput?.postProcess || {}), normalizeWhitespace: e.target.checked } } })} /> Normalize whitespace</label>
            <label style={{ marginLeft: 8 }}><input type="checkbox" checked={Boolean(node.data.structuredOutput?.postProcess?.ensureMarkdown)} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), postProcess: { ...(node.data.structuredOutput?.postProcess || {}), ensureMarkdown: e.target.checked } } })} /> Ensure Markdown headings</label>
            <label style={{ marginLeft: 8 }}><input type="checkbox" checked={Boolean(node.data.structuredOutput?.postProcess?.appendCitationsBlock)} onChange={(e) => update({ structuredOutput: { ...(node.data.structuredOutput || {}), postProcess: { ...(node.data.structuredOutput?.postProcess || {}), appendCitationsBlock: e.target.checked } } })} /> Append citations block if present</label>
          </div>
        </div>
      )}

      {tab === "Safety" && (
        <div className="ab-inspector__section">
          <h3>Safety & Guardrails</h3>
          <label className="ab-field ab-field--stack"><span>Policy</span>
            <input value={node.data.safety?.policyRef || "enterprise-v3"} onChange={(e) => update({ safety: { ...(node.data.safety || {}), policyRef: e.target.value } })} />
            <div className="ab-help">Select content policy pack for moderation and guidance.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>On Block</span>
            <select value={node.data.safety?.onBlock || "Refuse"} onChange={(e) => update({ safety: { ...(node.data.safety || {}), onBlock: e.target.value } })}>
              <option>Refuse</option><option>SafeAgent</option><option>AskForClarification</option>
            </select>
            <div className="ab-help">Action when output violates policy.</div>
          </label>
          {node.data.safety?.onBlock === "SafeAgent" && (
            <label className="ab-field ab-field--stack"><span>Safe Agent</span>
              <select value={node.data.safety?.safeAgentRef || ""} onChange={(e) => update({ safety: { ...(node.data.safety || {}), safeAgentRef: e.target.value } })}>
                <option value="">Select…</option>
                {state.ir.nodes.filter((n) => n.kind === "agent.codeless").map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <div className="ab-help">Route here when content is blocked.</div>
            </label>
          )}
          <label className="ab-field ab-field--check"><span>PII Redaction</span>
            <input type="checkbox" checked={Boolean(node.data.safety?.piiRedaction ?? true)} onChange={(e) => update({ safety: { ...(node.data.safety || {}), piiRedaction: e.target.checked } })} />
            <div className="ab-help">Apply PII redaction to outputs and/or tools.</div>
          </label>
          <label className="ab-field ab-field--check"><span>Prompt Inj. Defense</span>
            <input type="checkbox" checked={Boolean(node.data.safety?.promptInjectionDefense)} onChange={(e) => update({ safety: { ...(node.data.safety || {}), promptInjectionDefense: e.target.checked } })} />
            <div className="ab-help">Add defenses against prompt injection; constrains tool use.</div>
          </label>
        </div>
      )}

      {tab === "Telemetry" && (
        <div className="ab-inspector__section">
          <h3>Telemetry</h3>
          <label className="ab-field ab-field--check"><span>Emit Usage</span>
            <input type="checkbox" checked={node.data.telemetry?.emitUsage ?? true} onChange={(e) => update({ telemetry: { ...(node.data.telemetry || {}), emitUsage: e.target.checked } })} />
            <div className="ab-help">Record tokens and tool counts; content not stored.</div>
          </label>
          <label className="ab-field ab-field--stack"><span>Labels (JSON)</span>
            <AutoTextarea value={JSON.stringify(node.data.telemetry?.labels || {}, null, 2)} onChange={(val) => { try { update({ telemetry: { ...(node.data.telemetry || {}), labels: JSON.parse(val) } }); } catch {} }} minRows={3} />
            <div className="ab-help">Key/value tags for dashboards (e.g., domain=HR).</div>
          </label>
        </div>
      )}

      {tab === "Validation" && (
        <div className="ab-inspector__section">
          <h3>Validation</h3>
          <ul>
            {issues.map((i, idx) => <li key={idx}>{i.severity === "warning" ? "⚠️" : "⛔"} {i.message}</li>)}
            {issues.length === 0 && <li>✓ No issues</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
