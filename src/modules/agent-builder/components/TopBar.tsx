import { useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAgentBuilder } from "../store/AgentBuilderContext";
import { IRGraph } from "../model/ir";
import { download, parseIR, saveToLocalStorage, serializeIR } from "../utils/exportImport";
import { useValidation } from "../hooks/useValidation";

export function TopBar(): JSX.Element {
  const { state, dispatch } = useAgentBuilder();
  const { validateIR, computeIssues } = useValidation();
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

  const onTidy = () => dispatch({ type: "TIDY" });

  return (
    <div className="ab-topbar" role="toolbar" aria-label="Agent Builder toolbar">
      <div className="ab-group">
        <button className="ab-btn ab-btn--ghost" onClick={onNew}>New</button>
        <button className="ab-btn ab-btn--success" onClick={onSave} disabled={!state.dirty}>Save</button>
        <button className="ab-btn ab-btn--outline" onClick={onExport} disabled={computeIssues(state.ir).some((i) => i.severity === "error")}>Export JSON</button>
        <button className="ab-btn ab-btn--outline" onClick={onImport}>Import JSON</button>
      </div>
      <span className="ab-topbar__spacer" />
      <div className="ab-group">
        <button className="ab-btn ab-btn--primary" onClick={onValidate}>Validate</button>
        <button className="ab-btn ab-btn--secondary" onClick={onTidy}>Tidy layout</button>
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
