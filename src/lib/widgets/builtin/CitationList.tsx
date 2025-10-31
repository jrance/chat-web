import React from "react";

export default function CitationList({ props }: { props?: any }) {
  const items = Array.isArray(props?.items) ? props.items : [];
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
      <div className="text-xs uppercase opacity-70 mb-2">Citations</div>
      <ul className="space-y-2">
        {items.map((c: any, idx: number) => (
          <li key={idx} className="text-sm">
            <a href={c.url} target="_blank" rel="noreferrer" className="underline">
              {c.title || c.url}
            </a>
            {c.snippet && <div className="opacity-80 text-xs mt-1">{c.snippet}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
