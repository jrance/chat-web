import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CheckboxField as CheckboxFieldT,
  DateTimeField as DateTimeFieldT,
  Field,
  FileField as FileFieldT,
  FileRef,
  FormSchema,
  FormValues,
  NumberField as NumberFieldT,
  SelectField as SelectFieldT,
  TextField as TextFieldT,
} from "../model/form";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";
import { CheckboxField } from "./fields/CheckboxField";
import { SelectField } from "./fields/SelectField";
import { DateTimeField } from "./fields/DateTimeField";
import { FileField } from "./fields/FileField";
import {
  UploadAdapter,
  collectFileRefs,
  createFetchUploadAdapter,
} from "../lib/uploads";

type ChatMessage = { role: "user" | "system" | "assistant"; content: unknown };

type Props = {
  schema: FormSchema;
  initialValues?: FormValues;
  uploader?: UploadAdapter;
  withMessages?: boolean;
  onSubmit: (output: {
    messages?: ChatMessage[];
    form: { values: FormValues };
    files?: FileRef[];
  }) => void;
};

export const EntryForm: React.FC<Props> = ({
  schema,
  initialValues,
  uploader,
  withMessages,
  onSubmit,
}) => {
  const [values, setValues] = useState<FormValues>(initialValues ?? {});
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    setValues(initialValues ?? {});
  }, [initialValues]);

  const effectiveUploader = useMemo(
    () => uploader ?? createFetchUploadAdapter({ endpoint: "/api/files" }),
    [uploader]
  );

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => {
      if (value === undefined) {
        if (Object.prototype.hasOwnProperty.call(prev, name)) {
          const next = { ...prev };
          delete next[name];
          return next;
        }
        return prev;
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const renderField = (field: Field) => {
    if (field.hidden) return null;
    const key = field.id;
    switch (field.kind) {
      case "text":
      case "textarea":
        return (
          <TextField
            key={key}
            field={field as TextFieldT}
            value={(values[field.name] as string) ?? ""}
            onChange={(val) => setValue(field.name, val)}
          />
        );
      case "number":
        return (
          <NumberField
            key={key}
            field={field as NumberFieldT}
            value={values[field.name] as string | number | undefined}
            onChange={(val) => setValue(field.name, val)}
          />
        );
      case "checkbox":
        return (
          <CheckboxField
            key={key}
            field={field as CheckboxFieldT}
            value={values[field.name] as boolean | undefined}
            onChange={(val) => setValue(field.name, val)}
          />
        );
      case "select":
        return (
          <SelectField
            key={key}
            field={field as SelectFieldT}
            value={values[field.name] as string | string[] | undefined}
            onChange={(val) => setValue(field.name, val)}
          />
        );
      case "datetime":
        return (
          <DateTimeField
            key={key}
            field={field as DateTimeFieldT}
            value={values[field.name] as string | undefined}
            onChange={(val) => setValue(field.name, val)}
          />
        );
      case "file":
        return (
          <FileField
            key={key}
            field={field as FileFieldT}
            value={values[field.name] as FileRef | FileRef[] | null}
            onChange={(val) => setValue(field.name, val)}
            uploader={effectiveUploader}
          />
        );
      default:
        return null;
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const files = collectFileRefs(values);

    onSubmit({
      messages:
        withMessages && messageText
          ? [{ role: "user" as const, content: messageText }]
          : undefined,
      form: { values },
      files: files.length ? files : undefined,
    });
  };

  return (
    <form className="ab-entry-form" onSubmit={handleSubmit}>
      {withMessages && (
        <div className="ab-chat">
          <label className="ab-label" htmlFor="ab-entry-message">
            Message
          </label>
          <textarea
            id="ab-entry-message"
            className="ab-textarea"
            placeholder="Type a message."
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
          />
        </div>
      )}

      {schema.title && <h3 className="ab-form-title">{schema.title}</h3>}

      {schema.fields.map(renderField)}

      <div className="ab-actions">
        <button type="submit" className="ab-btn ab-btn-primary">
          Execute
        </button>
      </div>
    </form>
  );
};
