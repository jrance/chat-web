import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileField as FileFieldT, FileRef } from "../../model/form";
import type { UploadAdapter } from "../../lib/uploads";

type Props = {
  field: FileFieldT;
  value?: FileRef | FileRef[] | null;
  onChange: (next: FileRef | FileRef[] | null) => void;
  uploader: UploadAdapter;
};

const normalizeValue = (value?: FileRef | FileRef[] | null): FileRef[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

function validateFile(field: FileFieldT, file: File): string | null {
  const sizeMB = file.size / (1024 * 1024);
  if (field.maxSizeMB && sizeMB > field.maxSizeMB) {
    return `File too large: ${sizeMB.toFixed(1)}MB > ${field.maxSizeMB}MB`;
  }
  if (field.accept && field.accept.length > 0 && !field.accept.includes(file.type)) {
    return `Unsupported type: ${file.type || "unknown"}`;
  }
  return null;
}

export const FileField: React.FC<Props> = ({ field, value, onChange, uploader }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FileRef[]>(() => normalizeValue(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowMany = !!field.multiple;
  const maxFiles = field.maxFiles ?? (allowMany ? 10 : 1);

  useEffect(() => {
    setItems(normalizeValue(value));
  }, [value]);

  const listLabel = useMemo(() => `${field.label} dropzone`, [field.label]);

  const updateValue = useCallback(
    (nextItems: FileRef[]) => {
      setItems(nextItems);
      onChange(allowMany ? nextItems : nextItems[0] ?? null);
    },
    [allowMany, onChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const next = [...items];
      let mutated = false;
      setError(null);
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          if (next.length >= maxFiles) break;
          const validationError = validateFile(field, file);
          if (validationError) {
            setError(validationError);
            continue;
          }
          try {
            const uploaded = await uploader.upload(file);
            next.push(uploaded);
            mutated = true;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Upload failed";
            setError(message);
          }
        }
      } finally {
        setBusy(false);
      }
      if (mutated) {
        updateValue(next);
      }
    },
    [field, items, maxFiles, updateValue, uploader]
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const onPick = () => inputRef.current?.click();

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick();
    }
  };

  const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <div className="ab-file-field">
      <label className="ab-label">{field.label}</label>
      <div
        className={`ab-dropzone${busy ? " is-busy" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-busy={busy}
        aria-label={listLabel}
        onClick={onPick}
        onKeyDown={onKeyDown}
      >
        <span>{busy ? "Uploading..." : "Click or drop files here"}</span>
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={onInput}
          multiple={allowMany}
          accept={field.accept?.join(",")}
          aria-hidden="true"
        />
      </div>
      {error && (
        <div role="alert" className="ab-error">
          {error}
        </div>
      )}
      {items.length > 0 && (
        <ul className="ab-file-list">
          {items.map((item) => (
            <li key={item.file_id}>
              <span className="ab-file-name">{item.display_name}</span>
              <span className="ab-file-meta">
                {item.mime_type}
                {typeof item.size === "number" ? ` - ${Math.round(item.size / 1024)} KB` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
