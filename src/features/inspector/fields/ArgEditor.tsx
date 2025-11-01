import React, { useMemo, useState } from "react";
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
  const enumOptions = (schema as any).enum as string[] | undefined;

  const [pendingEntry, setPendingEntry] = useState("");
  const arrayValue: string[] = useMemo(() => {
    if (schema.kind === "string[]") {
      return Array.isArray(value) ? value : [];
    }
    return [];
  }, [schema.kind, value]);

  const commitEntry = () => {
    const next = pendingEntry.trim();
    if (!next) return;
    if (arrayValue.includes(next)) {
      setPendingEntry("");
      return;
    }
    onChange([...arrayValue, next]);
    setPendingEntry("");
  };

  const removeEntry = (idx: number) => {
    const next = arrayValue.filter((_, i) => i !== idx);
    onChange(next);
  };

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
        enumOptions ? (
          <select className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
                  value={value ?? enumOptions[0] ?? ""}
                  onChange={e => onChange(e.target.value)}>
            {enumOptions.map(opt => <option key={opt} value={opt}>{opt === "" ? "None" : opt}</option>)}
          </select>
        ) : (
          <input className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
                 placeholder={(schema as any).placeholder}
                 value={value ?? ""} onChange={e => onChange(e.target.value)} />
        )
      )}
      {schema.kind === "string[]" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {arrayValue.map((entry, idx) => (
              <span key={entry} className="inline-flex items-center gap-1 bg-neutral-800 text-xs px-2 py-1 rounded-full">
                {entry}
                <button
                  type="button"
                  className="text-neutral-400 hover:text-neutral-100"
                  onClick={() => removeEntry(idx)}
                  aria-label={`Remove ${entry}`}
                >
                  ×
                </button>
              </span>
            ))}
            {!arrayValue.length && <span className="text-xs opacity-60">No entries</span>}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
              placeholder={(schema as any).placeholder || "Add value"}
              value={pendingEntry}
              onChange={(e) => setPendingEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitEntry();
                }
              }}
            />
            <button
              type="button"
              className="px-3 py-2 text-sm rounded bg-neutral-800"
              onClick={commitEntry}
              disabled={!pendingEntry.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}
      {schema.kind === "number" && (
        <input
          type="number"
          className="w-full bg-neutral-900 text-neutral-50 rounded px-3 py-2 text-sm"
          value={value ?? ""}
          min={(schema as any).min}
          max={(schema as any).max}
          step={(schema as any).step ?? 1}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
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
