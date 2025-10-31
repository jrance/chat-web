import React from "react";

export default function ErrorCallout({ props }: { props?: any }) {
  return (
    <div className="rounded-xl border border-red-800 p-3 bg-red-950/40 text-red-200">
      <div className="text-xs uppercase opacity-80 mb-1">Error</div>
      <div className="text-sm">{props?.title || "An error occurred."}</div>
      {props?.details && <pre className="mt-2 text-xs opacity-90 overflow-auto">{JSON.stringify(props.details, null, 2)}</pre>}
    </div>
  );
}
