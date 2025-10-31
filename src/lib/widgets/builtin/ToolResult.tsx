import React from "react";

export default function ToolResult({ props }: { props?: any }) {
  const name = props?.name ?? "tool";
  const summary = props?.summary;
  const details = props?.details;
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="text-xs uppercase opacity-70 mb-2">Tool Result: {name}</div>
      {summary && <div className="text-sm mb-2">{summary}</div>}
      {details && <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(details, null, 2)}</pre>}
    </div>
  );
}
