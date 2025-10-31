import React from "react";
import type { ArgSchema, Visibility } from "../../../lib/tools/shapes";

type Props = {
  schema: ArgSchema;
  value: any;
  visibility: Visibility;
  onChange: (value:any) => void;
  onVisibilityChange: (v: Visibility) => void;
};

export default function ArgEditor({ schema, value, visibility, onChange, onVisibilityChange }: Props) {
  const label = (schema as any).label ?? schema.name;
  const visOpts: Visibility[] = ["Normal","AgentOverride","LLMHidden"];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm">{label}</label>
        <select className="ml-auto bg-neutral-900 text-neutral-50 text-xs rounded px-2 py-1"
                value={visibility} onChange={e => onVisibilityChange(e.target.value as Visibility)}>
          {visOpts.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {schema.kind === "string" && (
        <input className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
               placeholder={(schema as any).placeholder}
               value={value ?? ""} onChange={e => onChange(e.target.value)} />
      )}
      {schema.kind === "number" && (
        <input type="number" className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
               value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      )}
      {schema.kind === "boolean" && (
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {label}
        </label>
      )}
      {/* Simple nested object editor (flat list) */}
      {schema.kind === "object" && Array.isArray(schema.properties) && (
        <div className="space-y-2 pl-2 border-l border-neutral-800">
          {schema.properties.map((p,i) => (
            <ArgEditor key={i} schema={p} value={value?.[p.name]}
              visibility={(p as any).visibility || "Normal"
              }
              onChange={(v:any) => onChange({ ...(value||{}), [p.name]: v })}
              onVisibilityChange={() => { /* nested vis not editable here */ }} />
          ))}
        </div>
      )}
    </div>
  );
}
