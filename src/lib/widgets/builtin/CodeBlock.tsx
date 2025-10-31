import React from "react";

export default function CodeBlock({ props }: { props?: any }) {
  const lang = props?.language ?? "text";
  const code = props?.content ?? "";
  return (
    <pre className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/70 text-xs overflow-auto">
      {/* No HTML rendering; safe plain text */}
      {code}
    </pre>
  );
}
