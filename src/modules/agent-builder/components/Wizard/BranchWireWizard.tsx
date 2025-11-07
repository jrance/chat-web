import React, { useEffect, useMemo, useState } from "react";
import type { Edge, EdgeMapping, GraphDoc, Id, NodeAny } from "../../model/ir";
import { getNode, nano } from "../../state/canvas";

type Props = {
  doc: GraphDoc;
  parentId: Id;
  onApply: (edgesToAdd: Edge[]) => void;
  onClose: () => void;
};

type EdgePlan = {
  from: Edge["from"];
  to: Edge["to"];
  mappings: EdgeMapping[];
};

const DEFAULT_PATH = "$";

export const BranchWireWizard: React.FC<Props> = ({ doc, parentId, onApply, onClose }) => {
  const parent = getNode(doc, parentId) as NodeAny | undefined;
  const broadcast = (parent?.config as { broadcast?: string[] } | undefined)?.broadcast ?? [];
  const children: NodeAny[] = useMemo(
    () =>
      ((parent?.config as { children?: Id[] } | undefined)?.children ?? [])
        .map((childId) => getNode(doc, childId))
        .filter((node): node is NodeAny => Boolean(node)),
    [doc, parent],
  );

  const childInputOptions = useMemo(() => {
    const set = new Set<string>();
    children.forEach((child) => child.inputs?.forEach((input) => set.add(input.name)));
    return set.size > 0 ? Array.from(set) : ["messages", "context"];
  }, [children]);

  const childOutputOptions = useMemo(() => {
    const set = new Set<string>();
    children.forEach((child) => child.outputs?.forEach((output) => set.add(output.name)));
    return set.size > 0 ? Array.from(set) : ["output", "text"];
  }, [children]);

  const [sourcePort, setSourcePort] = useState<string>(() =>
    broadcast.includes("messages") ? "messages" : broadcast[0] ?? "messages",
  );
  const [childTargetPort, setChildTargetPort] = useState<string>(childInputOptions[0] ?? "messages");
  const [childResultPort, setChildResultPort] = useState<string>(childOutputOptions[0] ?? "output");
  const [evidenceFieldJsonPath, setEvidenceFieldJsonPath] = useState<string>(DEFAULT_PATH);

  useEffect(() => {
    if (broadcast.length === 0) {
      setSourcePort("messages");
      return;
    }
    if (!broadcast.includes(sourcePort)) {
      setSourcePort(broadcast[0] ?? "messages");
    }
  }, [broadcast, sourcePort]);

  useEffect(() => {
    if (childInputOptions.length > 0 && !childInputOptions.includes(childTargetPort)) {
      setChildTargetPort(childInputOptions[0]);
    }
  }, [childInputOptions, childTargetPort]);

  useEffect(() => {
    if (childOutputOptions.length > 0 && !childOutputOptions.includes(childResultPort)) {
      setChildResultPort(childOutputOptions[0]);
    }
  }, [childOutputOptions, childResultPort]);

  const edgePlans = useMemo<EdgePlan[]>(() => {
    if (!parent) {
      return [];
    }
    const plans: EdgePlan[] = [];
    const mappingFrom =
      sourcePort.startsWith("$.") || sourcePort.startsWith("$[")
        ? sourcePort
        : `$.${sourcePort}`.replace(/\.+/g, (match: string) => (match.length > 1 ? "." : match));

    children.forEach((child) => {
      plans.push({
        from: { nodeId: parent.id, port: sourcePort },
        to: { nodeId: child.id, port: childTargetPort },
        mappings: [{ from: mappingFrom, to: childTargetPort }],
      });
      plans.push({
        from: { nodeId: child.id, port: childResultPort },
        to: { nodeId: parent.id, port: "evidence" },
        mappings: [{ from: evidenceFieldJsonPath || DEFAULT_PATH, to: "evidence", reduce: "list_concat" }],
      });
    });
    return plans;
  }, [children, childResultPort, childTargetPort, evidenceFieldJsonPath, parent, sourcePort]);

  const edgesToAdd = useMemo<Edge[]>(() => {
    return edgePlans.map((plan, index) => ({
      id: `wizard_${nano()}_${index}`,
      from: plan.from,
      to: plan.to,
      mappings: plan.mappings,
    }));
  }, [edgePlans]);

  const hasChildren = children.length > 0;
  const canApply = parent && hasChildren;

  return (
    <aside className="ab-wizard" aria-label="Branch wire wizard">
      <header className="ab-wizard-header">
        <strong>Branch Wire Wizard</strong>
        <button type="button" className="ab-btn" onClick={onClose}>
          Close
        </button>
      </header>

      <section className="ab-wizard-body">
        {!parent ? (
          <div className="ab-help">Parent node not found. Close the wizard and retry.</div>
        ) : null}
        {parent && !hasChildren ? (
          <div className="ab-help">Select at least one child on the Parallel Branches card.</div>
        ) : null}

        <div className="ab-grid-2">
          <div>
            <label className="ab-label">Broadcast source</label>
            <select
              className="ab-select"
              value={sourcePort}
              onChange={(event) => setSourcePort(event.target.value)}
            >
              <option value="messages" disabled={!broadcast.includes("messages") && broadcast.length > 0}>
                messages
              </option>
              <option value="context" disabled={!broadcast.includes("context") && broadcast.length > 0}>
                context
              </option>
            </select>
            <small className="ab-help">Only broadcast fields remain enabled.</small>
          </div>
          <div>
            <label className="ab-label">Target child input</label>
            <select
              className="ab-select"
              value={childTargetPort}
              onChange={(event) => setChildTargetPort(event.target.value)}
            >
              {childInputOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ab-grid-2">
          <div>
            <label className="ab-label">Child result port</label>
            <select
              className="ab-select"
              value={childResultPort}
              onChange={(event) => setChildResultPort(event.target.value)}
            >
              {childOutputOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ab-label">Evidence JSONPath</label>
            <input
              className="ab-input"
              value={evidenceFieldJsonPath}
              placeholder="$"
              onChange={(event) => setEvidenceFieldJsonPath(event.target.value)}
            />
            <small className="ab-help">
              Use <code>$</code> for full payload or paths like <code>$.data</code>.
            </small>
          </div>
        </div>

        <div>
          <label className="ab-label">Edges to add</label>
          <pre className="ab-pre" aria-live="polite">
            {JSON.stringify(edgesToAdd, null, 2)}
          </pre>
        </div>
      </section>

      <footer className="ab-wizard-actions">
        <button
          type="button"
          className="ab-btn ab-btn-primary"
          disabled={!canApply}
          onClick={() => canApply && onApply(edgesToAdd)}
        >
          Apply
        </button>
      </footer>
    </aside>
  );
};
