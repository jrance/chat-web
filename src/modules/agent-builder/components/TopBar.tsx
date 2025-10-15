import { useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { IRGraph } from "../model/ir";
import { download, parseIR, saveToLocalStorage, serializeIR } from "../utils/exportImport";
import { useValidation } from "../hooks/useValidation";
import { useCompile } from "../hooks/useCompile";

export function TopBar(): JSX.Element {
  const { state, dispatch } = useAgentBuilder();
  const { validateIR, computeIssues } = useValidation();
  const { runCompile, loading: compiling, error: compileError, result: compileResult } = useCompile();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onNew = () => {
    const id = uuidv4();
    const ir: IRGraph = { meta: { id, name: "Untitled Graph", version: "1.0.0" }, nodes: [], edges: [] };
    dispatch({ type: "SET_GRAPH", ir });
  };

  const onSave = () => {
    const key = `agent-builder:${state.ir.meta.id}`;
    saveToLocalStorage(key, state.ir);
    if (state.autoTidyOnSave) dispatch({ type: "TIDY" });
    dispatch({ type: "SET_DIRTY", value: false });
  };

  const onExport = () => {
    const text = serializeIR(state.ir);
    download(`${state.ir.meta.name || "graph"}.json`, text);
  };

  const onImport = () => fileRef.current?.click();

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ir = parseIR(text);
    dispatch({ type: "SET_GRAPH", ir });
    e.currentTarget.value = "";
  };

  const onValidate = () => validateIR(state.ir);

  const onCompile = async () => {
    try {
      await runCompile(state.ir);
    } catch {
      // error state handled via compileError
    }
  };

  const onTidy = () => dispatch({ type: "TIDY" });
  const onTest = () => {
    // Find currently selected agent or first codeless agent
    const selectedId = state.selectedNodeId;
    const isAgentSelected = selectedId && state.ir.nodes.find((n) => n.id === selectedId && n.kind === "agent.codeless");
    const target = (isAgentSelected ? selectedId : state.ir.nodes.find((n) => n.kind === "agent.codeless")?.id) as string | undefined;
    if (target) {
      // Focus that node and open its Test tab
      if (state.selectedNodeId !== target) dispatch({ type: "SELECT_NODE", id: target });
      // fire-and-forget marker read by inspector to switch tabs
      (dispatch as any)({ type: "OPEN_TEST", nodeId: target });
    }
  };

  return (
    <div className="ab-topbar" role="toolbar" aria-label="Agent Builder toolbar">
      <div className="ab-group">
        <button className="ab-btn ab-btn--ghost" onClick={onNew}>New</button>
        <button className="ab-btn ab-btn--success" onClick={onSave} disabled={!state.dirty}>Save</button>
        <button className="ab-btn ab-btn--outline" onClick={onExport} disabled={computeIssues(state.ir).some((i) => i.severity === "error")}>Export JSON</button>
        <button className="ab-btn ab-btn--outline" onClick={onImport}>Import JSON</button>
      </div>
      <span className="ab-topbar__spacer" />
      <div className="ab-group" style={{ alignItems: "center", display: "flex", gap: 8 }}>
        <button className="ab-btn ab-btn--primary" onClick={onValidate}>Validate</button>
        <button className="ab-btn ab-btn--primary" onClick={onCompile} disabled={compiling}>
          {compiling ? "Compiling…" : "Compile"}
        </button>
        {compileResult && (
          <span aria-live="polite" style={{ color: "#2e7d32", fontSize: 12 }}>
            Compiled ✓{compileResult.orchestration ? ` (${compileResult.orchestration})` : ""}
          </span>
        )}
        {compileError && (
          <span aria-live="assertive" style={{ color: "#c62828", fontSize: 12 }}>Compile failed: {compileError}</span>
        )}
        <button className="ab-btn ab-btn--secondary" onClick={onTidy}>Tidy layout</button>
        <button className="ab-btn ab-btn--outline" onClick={onTest}>Test</button>
        <label className="ab-topbar__toggle">
          <input
            type="checkbox"
            checked={state.autoTidyOnSave}
            onChange={(e) => dispatch({ type: "SET_AUTO_TIDY", value: e.target.checked })}
          />
          Auto-tidy on save
        </label>
      </div>
      <input type="file" accept="application/json" ref={fileRef} style={{ display: "none" }} onChange={onFileSelected} />
    </div>
  );
}
