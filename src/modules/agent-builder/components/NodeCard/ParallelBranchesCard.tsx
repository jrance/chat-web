import React, { useMemo } from "react";
import type { ParallelBranchesNode, NodeAny, Id } from "../../model/ir";

type Props = {
  node: ParallelBranchesNode;
  onChange: (next: ParallelBranchesNode) => void;
  allNodes: NodeAny[];
  onOpenWireWizard: (parentId: Id) => void;
};

export const ParallelBranchesCard: React.FC<Props> = ({
  node,
  onChange,
  allNodes,
  onOpenWireWizard,
}) => {
  const config = node.config;

  const candidates = useMemo(
    () => allNodes.filter((n) => n.id !== node.id && n.kind !== "entry.form"),
    [allNodes, node.id],
  );

  const children = config.children ?? [];
  const broadcast = config.broadcast ?? [];
  const join = config.join;

  const toggleChild = (id: Id) => {
    const next = new Set(children);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({
      ...node,
      config: { ...config, children: Array.from(next) },
    });
  };

  const toggleBroadcast = (key: string) => {
    const next = new Set(broadcast);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange({
      ...node,
      config: { ...config, broadcast: Array.from(next) },
    });
  };

  const handleJoinChoice = (choice: "all" | "any" | "custom") => {
    if (choice === "custom") {
      const nextJoin =
        typeof join === "string"
          ? { timeoutMs: 15_000, policy: "partial" as const }
          : { ...join };
      onChange({ ...node, config: { ...config, join: nextJoin } });
      return;
    }
    onChange({ ...node, config: { ...config, join: choice } });
  };

  const joinMode = typeof join === "string" ? join : "custom";

  return (
    <div className="ab-card">
      <div className="ab-field">
        <label className="ab-label">Children (run in parallel)</label>
        <div className="ab-list">
          {candidates.length === 0 ? (
            <span className="ab-help">Add nodes to select children.</span>
          ) : (
            candidates.map((child) => (
              <label key={child.id} className="ab-checkline">
                <input
                  type="checkbox"
                  checked={children.includes(child.id)}
                  onChange={() => toggleChild(child.id)}
                />
                <span>
                  {child.name ?? child.kind} - <code>{child.id}</code>
                </span>
              </label>
            ))
          )}
        </div>
        <small className="ab-help">Pick the nodes to execute concurrently.</small>
      </div>

      <div className="ab-field">
        <label className="ab-label">Broadcast</label>
        <label className="ab-checkline">
          <input
            type="checkbox"
            checked={broadcast.includes("messages")}
            onChange={() => toggleBroadcast("messages")}
          />
          messages
        </label>
        <label className="ab-checkline">
          <input
            type="checkbox"
            checked={broadcast.includes("context")}
            onChange={() => toggleBroadcast("context")}
          />
          context
        </label>
        <small className="ab-help">Selected fields are forwarded to each child.</small>
      </div>

      <div className="ab-field">
        <label className="ab-label">Join policy</label>
        <select
          className="ab-select"
          value={joinMode}
          onChange={(event) => handleJoinChoice(event.target.value as typeof joinMode | "custom")}
        >
          <option value="all">all — wait for all children</option>
          <option value="any">any — resolve on first success</option>
          <option value="custom">custom — timeout rules</option>
        </select>
        {typeof join !== "string" ? (
          <div className="ab-grid-2 ab-grid-2--tight">
            <label className="ab-label">
              Timeout (ms)
              <input
                className="ab-input"
                type="number"
                value={join.timeoutMs}
                onChange={(event) => {
                  const timeoutMs = Number(event.target.value || 0);
                  onChange({
                    ...node,
                    config: { ...config, join: { ...join, timeoutMs } },
                  });
                }}
              />
            </label>
            <label className="ab-label">
              Policy
              <select
                className="ab-select"
                value={join.policy}
                onChange={(event) => {
                  onChange({
                    ...node,
                    config: { ...config, join: { ...join, policy: event.target.value as "partial" | "fail" } },
                  });
                }}
              >
                <option value="partial">partial — proceed with finished children</option>
                <option value="fail">fail — treat timeout as error</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div className="ab-actions">
        <button
          type="button"
          className="ab-btn"
          onClick={() => onOpenWireWizard(node.id)}
        >
          Open Branch Wire Wizard
        </button>
      </div>

      <div className="ab-note">
        <strong>Evidence fan-in:</strong> map each child result back to the parent&rsquo;s{" "}
        <code>evidence</code> output (reducer <code>list_concat</code>). Use the wizard to auto-wire edges.
      </div>
    </div>
  );
};
