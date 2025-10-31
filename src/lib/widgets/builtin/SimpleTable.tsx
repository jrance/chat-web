import React from "react";

export default function SimpleTable({ props }: { props?: any }) {
  const cols: string[] = props?.columns || [];
  const rows: any[][] = props?.rows || [];
  return (
    <div className="rounded-xl border border-neutral-800 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900/60">
          <tr>{cols.map((c, i) => <th key={i} className="text-left px-3 py-2">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-800">
              {r.map((cell, j) => <td key={j} className="px-3 py-2">{String(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
