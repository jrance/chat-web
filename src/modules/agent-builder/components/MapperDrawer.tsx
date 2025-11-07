import React, { Fragment, useEffect, useMemo, useState } from "react";
import type { EdgeMapping, GraphDoc, Id, PortSchema, Transform, Validator } from "../model/ir";
import { applyEdgeMappings, applyMapping } from "../lib/mapper";
import { buildNodeOutputPreview } from "../lib/preview";
import { getNode, portSchemaOf } from "../state/canvas";

type Props = {
  doc: GraphDoc;
  edgeId: Id;
  upstreamPreview?: Record<string, unknown>;
  onChange: (nextMappings: EdgeMapping[]) => void;
  onClose: () => void;
};

type MappingRowProps = {
  mapping: EdgeMapping;
  onChange: (mapping: EdgeMapping) => void;
  onRemove: () => void;
  previewSource?: unknown;
};

export const MapperDrawer: React.FC<Props> = ({ doc, edgeId, upstreamPreview, onChange, onClose }) => {
  const edge = useMemo(() => doc.edges.find((e) => e.id === edgeId), [doc.edges, edgeId]);
  const [mappings, setMappings] = useState<EdgeMapping[]>(edge?.mappings ?? []);

  useEffect(() => {
    setMappings(edge?.mappings ?? []);
  }, [edge]);

  if (!edge) {
    return null;
  }

  const sourceNode = getNode(doc, edge.from.nodeId);
  const targetNode = getNode(doc, edge.to.nodeId);
  const sourceSchema = sourceNode ? portSchemaOf(sourceNode, "out", edge.from.port) : undefined;
  const targetSchema = targetNode ? portSchemaOf(targetNode, "in", edge.to.port) : undefined;
  const previewData = upstreamPreview ?? buildNodeOutputPreview(sourceNode);

  const addMapping = () => {
    setMappings((prev) => [...prev, { from: "$", to: "", transforms: [] }]);
  };
  const removeMapping = (idx: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  };
  const changeMapping = (idx: number, next: EdgeMapping) => {
    setMappings((prev) => prev.map((mapping, i) => (i === idx ? next : mapping)));
  };

  const runEdgePreview = () => {
    const result = applyEdgeMappings(previewData ?? {}, mappings);
    return result.ok ? JSON.stringify(result.value, null, 2) : result.errors[0]?.message ?? "error";
  };

  return (
    <aside className="ab-mapper" aria-label="Mapper drawer">
      <header className="ab-mapper-header">
        <div>
          <strong>Data Mapper</strong>
          <div className="ab-label ab-label--subtle">Define how data flows along this edge.</div>
        </div>
        <button className="ab-btn" type="button" onClick={onClose}>
          Close
        </button>
      </header>

      <section className="ab-mapper-meta">
        <div>
          <span>From </span>
          <code>{edge.from.nodeId}:{edge.from.port}</code>
          {sourceSchema ? <TypeHint schema={sourceSchema} /> : null}
        </div>
        <div>
          <span>To </span>
          <code>{edge.to.nodeId}:{edge.to.port}</code>
          {targetSchema ? <TypeHint schema={targetSchema} /> : null}
        </div>
      </section>

      <section className="ab-mapper-rows">
        {mappings.map((mapping, index) => (
          <MappingRow
            key={`${mapping.to}-${index}`}
            mapping={mapping}
            onChange={(next) => changeMapping(index, next)}
            onRemove={() => removeMapping(index)}
            previewSource={previewData}
          />
        ))}
        <div>
          <button className="ab-btn" type="button" onClick={addMapping}>
            + Add mapping
          </button>
        </div>
      </section>

      <section className="ab-mapper-preview">
        <div className="ab-col">
          <label>Upstream Preview</label>
          <pre className="ab-pre">{JSON.stringify(previewData ?? {}, null, 2)}</pre>
        </div>
        <div className="ab-col">
          <label>Result Preview</label>
          <pre className="ab-pre">{runEdgePreview()}</pre>
        </div>
      </section>

      <footer className="ab-mapper-actions">
        <button className="ab-btn ab-btn-primary" type="button" onClick={() => onChange(mappings)}>
          Save
        </button>
      </footer>
    </aside>
  );
};

function MappingRow({ mapping, onChange, onRemove, previewSource }: MappingRowProps) {
  const [preview, setPreview] = useState<string>("");

  const updateDefault = (text: string) => {
    if (text.trim() === "") {
      onChange({ ...mapping, default: undefined });
      return;
    }
    try {
      onChange({ ...mapping, default: JSON.parse(text) });
    } catch {
      onChange({ ...mapping, default: text });
    }
  };

  const defaultValue = stringifyValue(mapping.default);

  const runPreview = () => {
    const result = applyMapping(previewSource ?? {}, mapping);
    setPreview(result.ok ? JSON.stringify(result.value) : result.errors[0]?.message ?? "error");
  };

  return (
    <div className="ab-map-row">
      <div className="ab-row-main">
        <div className="ab-col">
          <label className="ab-label">JSONPath (from)</label>
          <input
            className="ab-input"
            value={mapping.from}
            onChange={(event) => onChange({ ...mapping, from: event.target.value })}
            placeholder="$.form.values.concurrency"
          />
        </div>
        <div className="ab-col">
          <label className="ab-label">Target key (to)</label>
          <input
            className="ab-input"
            value={mapping.to}
            onChange={(event) => onChange({ ...mapping, to: event.target.value })}
            placeholder="concurrency"
          />
        </div>
        <div className="ab-col">
          <label className="ab-label">Default</label>
          <input
            className="ab-input"
            value={defaultValue}
            onChange={(event) => updateDefault(event.target.value)}
            placeholder='e.g. 8 or {"status":"pending"}'
          />
        </div>
        <div className="ab-col ab-col-narrow">
          <button className="ab-btn" type="button" onClick={runPreview}>
            Preview
          </button>
          {preview ? <div className="ab-preview">{preview}</div> : null}
        </div>
        <button type="button" className="ab-row-remove" aria-label="remove mapping" onClick={onRemove}>
          x
        </button>
      </div>

      <div className="ab-row-sub">
        <div>
          <strong>Transforms</strong>
          <TransformList mapping={mapping} onChange={onChange} />
        </div>
        <div>
          <strong>Validators</strong>
          <ValidatorList mapping={mapping} onChange={onChange} />
        </div>
        <label className="ab-label ab-label--check">
          <input
            type="checkbox"
            checked={mapping.reduce === "list_concat"}
            onChange={(event) => onChange({ ...mapping, reduce: event.target.checked ? "list_concat" : undefined })}
          />
          reduce: list_concat
        </label>
      </div>
    </div>
  );
}

function TransformList({ mapping, onChange }: { mapping: EdgeMapping; onChange: (mapping: EdgeMapping) => void }) {
  const transforms = mapping.transforms ?? [];
  const setTransforms = (next: Transform[]) => {
    onChange({ ...mapping, transforms: next.length ? next : undefined });
  };
  const add = (kind: Transform["kind"]) => {
    setTransforms([...transforms, defaultTransform(kind)]);
  };
  const remove = (index: number) => {
    setTransforms(transforms.filter((_, i) => i !== index));
  };
  const update = (index: number, next: Transform) => {
    setTransforms(transforms.map((transform, i) => (i === index ? next : transform)));
  };

  return (
    <div className="ab-transform-list">
      <div className="ab-transform-chips">
        {transforms.map((transform, index) => (
          <span className="ab-chip" key={`${transform.kind}-${index}`}>
            <span>{transform.kind}</span>
            <button type="button" onClick={() => remove(index)} aria-label={`remove ${transform.kind}`}>
              x
            </button>
          </span>
        ))}
      </div>

      {transforms.map((transform, index) => (
        <TransformParams key={`${transform.kind}-${index}`} transform={transform} index={index} onChange={update} />
      ))}

      <div className="ab-add">
        <TransformAddButton onAdd={add} kind="to_number" />
        <TransformAddButton onAdd={add} kind="clamp" />
        <TransformAddButton onAdd={add} kind="wrap_array" />
        <TransformAddButton onAdd={add} kind="pick" />
        <TransformAddButton onAdd={add} kind="merge" />
        <TransformAddButton onAdd={add} kind="to_string" />
        <TransformAddButton onAdd={add} kind="to_boolean" />
        <TransformAddButton onAdd={add} kind="parse_date" />
        <TransformAddButton onAdd={add} kind="regex_replace" />
      </div>
    </div>
  );
}

function TransformParams({
  transform,
  index,
  onChange,
}: {
  transform: Transform;
  index: number;
  onChange: (index: number, next: Transform) => void;
}) {
  switch (transform.kind) {
    case "clamp":
      return (
        <div className="ab-transform-params">
          <label className="ab-label">
            min
            <input
              type="number"
              className="ab-input"
              value={transform.min ?? ""}
              onChange={(event) =>
                onChange(index, { ...transform, min: event.target.value === "" ? undefined : Number(event.target.value) })
              }
            />
          </label>
          <label className="ab-label">
            max
            <input
              type="number"
              className="ab-input"
              value={transform.max ?? ""}
              onChange={(event) =>
                onChange(index, { ...transform, max: event.target.value === "" ? undefined : Number(event.target.value) })
              }
            />
          </label>
        </div>
      );
    case "pick":
      return (
        <div className="ab-transform-params">
          <label className="ab-label">
            Paths (one per line)
            <textarea
              className="ab-textarea"
              value={transform.paths.join("\n")}
              onChange={(event) =>
                onChange(
                  index,
                  {
                    ...transform,
                    paths: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  },
                )
              }
            />
          </label>
        </div>
      );
    case "merge":
      return (
        <div className="ab-transform-params ab-transform-params-grid">
          <label className="ab-label">Merge fields</label>
          <MergeEditor transform={transform} index={index} onChange={onChange} />
        </div>
      );
    case "parse_date":
      return (
        <div className="ab-transform-params">
          <label className="ab-label">
            Format
            <input
              className="ab-input"
              value={transform.format ?? ""}
              onChange={(event) => onChange(index, { ...transform, format: event.target.value || undefined })}
              placeholder="iso"
            />
          </label>
        </div>
      );
    case "regex_replace":
      return (
        <div className="ab-transform-params ab-transform-params-grid">
          <label className="ab-label">
            Pattern
            <input
              className="ab-input"
              value={transform.pattern}
              onChange={(event) => onChange(index, { ...transform, pattern: event.target.value })}
            />
          </label>
          <label className="ab-label">
            Replacement
            <input
              className="ab-input"
              value={transform.replacement}
              onChange={(event) => onChange(index, { ...transform, replacement: event.target.value })}
            />
          </label>
          <label className="ab-label">
            Flags
            <input
              className="ab-input"
              value={transform.flags ?? ""}
              onChange={(event) => onChange(index, { ...transform, flags: event.target.value || undefined })}
              placeholder="g"
            />
          </label>
        </div>
      );
    default:
      return null;
  }
}

function MergeEditor({
  transform,
  index,
  onChange,
}: {
  transform: Extract<Transform, { kind: "merge" }>;
  index: number;
  onChange: (index: number, next: Transform) => void;
}) {
  const entries = Object.entries(transform.obj ?? {});
  const updateEntry = (entryIndex: number, key: string, value: string) => {
    const currentKey = entries[entryIndex]?.[0] ?? "";
    const nextObj = { ...transform.obj };
    if (currentKey && currentKey !== key) {
      delete (nextObj as Record<string, unknown>)[currentKey];
    }
    (nextObj as Record<string, unknown>)[key] = parseLiteral(value);
    onChange(index, { ...transform, obj: nextObj });
  };

  const removeEntry = (entryIndex: number) => {
    const nextObj = { ...transform.obj };
    const currentKey = entries[entryIndex]?.[0];
    if (currentKey) {
      delete (nextObj as Record<string, unknown>)[currentKey];
    }
    onChange(index, { ...transform, obj: nextObj });
  };

  const addEntry = () => {
    const nextObj = { ...transform.obj, [`key_${entries.length + 1}`]: "value" };
    onChange(index, { ...transform, obj: nextObj });
  };

  return (
    <div className="ab-merge-editor">
      {entries.length === 0 ? <div className="ab-help">No fields yet.</div> : null}
      {entries.map(([key, value], entryIndex) => (
        <Fragment key={`${key}-${entryIndex}`}>
          <div className="ab-merge-row">
            <input
              className="ab-input"
              value={key}
              onChange={(event) => updateEntry(entryIndex, event.target.value, stringifyValue(value))}
              placeholder="fieldName"
            />
            <input
              className="ab-input"
              value={stringifyValue(value)}
              onChange={(event) => updateEntry(entryIndex, key, event.target.value)}
              placeholder='e.g. "value" or 42'
            />
            <button type="button" className="ab-btn" onClick={() => removeEntry(entryIndex)} aria-label="remove field">
              x
            </button>
          </div>
        </Fragment>
      ))}
      <button type="button" className="ab-btn" onClick={addEntry}>
        + Add field
      </button>
    </div>
  );
}

function ValidatorList({ mapping, onChange }: { mapping: EdgeMapping; onChange: (mapping: EdgeMapping) => void }) {
  const validators = mapping.validators ?? [];
  const setValidators = (next: Validator[]) => {
    onChange({ ...mapping, validators: next.length ? next : undefined });
  };
  const add = (kind: Validator["kind"]) => {
    const defaults: Validator = kind === "min" || kind === "max"
      ? { kind, value: 0 }
      : kind === "regex"
        ? { kind, pattern: "", flags: "i" }
        : kind === "enum"
          ? { kind, values: [] }
          : { kind: "required" };
    setValidators([...validators, defaults]);
  };
  const remove = (index: number) => {
    setValidators(validators.filter((_, i) => i !== index));
  };
  const update = (index: number, next: Validator) => {
    setValidators(validators.map((validator, i) => (i === index ? next : validator)));
  };

  return (
    <div className="ab-validator-list">
      {validators.map((validator, index) => (
        <div className="ab-validator-row" key={`${validator.kind}-${index}`}>
          <span className="ab-chip">
            <span>{validator.kind}</span>
            <button type="button" onClick={() => remove(index)} aria-label={`remove ${validator.kind}`}>
              x
            </button>
          </span>
          <ValidatorParams validator={validator} index={index} onChange={update} />
        </div>
      ))}
      <div className="ab-add">
        <ValidatorAddButton onAdd={add} kind="required" />
        <ValidatorAddButton onAdd={add} kind="min" />
        <ValidatorAddButton onAdd={add} kind="max" />
        <ValidatorAddButton onAdd={add} kind="regex" />
        <ValidatorAddButton onAdd={add} kind="enum" />
      </div>
    </div>
  );
}

function ValidatorParams({
  validator,
  index,
  onChange,
}: {
  validator: Validator;
  index: number;
  onChange: (index: number, next: Validator) => void;
}) {
  switch (validator.kind) {
    case "min":
    case "max":
      return (
        <label className="ab-label">
          value
          <input
            type="number"
            className="ab-input"
            value={validator.value}
            onChange={(event) => onChange(index, { ...validator, value: Number(event.target.value) })}
          />
        </label>
      );
    case "regex":
      return (
        <div className="ab-transform-params-grid">
          <label className="ab-label">
            pattern
            <input
              className="ab-input"
              value={validator.pattern}
              onChange={(event) => onChange(index, { ...validator, pattern: event.target.value })}
            />
          </label>
          <label className="ab-label">
            flags
            <input
              className="ab-input"
              value={validator.flags ?? ""}
              onChange={(event) => onChange(index, { ...validator, flags: event.target.value || undefined })}
            />
          </label>
        </div>
      );
    case "enum":
      return (
        <label className="ab-label">
          values (comma separated)
          <input
            className="ab-input"
            value={validator.values.join(", ")}
            onChange={(event) =>
              onChange(
                index,
                {
                  ...validator,
                  values: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              )
            }
          />
        </label>
      );
    default:
      return null;
  }
}

const TransformAddButton = ({ onAdd, kind }: { onAdd: (kind: Transform["kind"]) => void; kind: Transform["kind"] }) => (
  <button type="button" className="ab-btn" onClick={() => onAdd(kind)}>
    + {kind}
  </button>
);

const ValidatorAddButton = ({ onAdd, kind }: { onAdd: (kind: Validator["kind"]) => void; kind: Validator["kind"] }) => (
  <button type="button" className="ab-btn" onClick={() => onAdd(kind)}>
    + {kind}
  </button>
);

function defaultTransform(kind: Transform["kind"]): Transform {
  switch (kind) {
    case "clamp":
      return { kind };
    case "pick":
      return { kind, paths: ["$"] };
    case "merge":
      return { kind, obj: {} };
    case "regex_replace":
      return { kind, pattern: "", replacement: "", flags: "g" };
    case "parse_date":
      return { kind, format: "iso" };
    default:
      return { kind } as Transform;
  }
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseLiteral(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") {
    return "";
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

const TypeHint = ({ schema }: { schema: PortSchema }) => (
  <span className="ab-type-hint">{schema.type}</span>
);
