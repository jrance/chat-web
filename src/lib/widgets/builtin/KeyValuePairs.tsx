import React from "react";

export default function KeyValuePairs({ props }: { props?: any }) {
  const entries: Array<{ key: string; value: any }> = props?.entries || [];
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="grid grid-cols-3 gap-2 text-sm">
        {entries.map((kv, i) => (
          <React.Fragment key={i}>
            <div className="opacity-70">{kv.key}</div>
            <div className="col-span-2">{String(kv.value)}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
