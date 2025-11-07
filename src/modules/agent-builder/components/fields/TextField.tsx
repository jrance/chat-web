import React from "react";
import type { TextField as TextFieldT } from "../../model/form";

type Props = {
  field: TextFieldT;
  value?: string;
  onChange: (value: string) => void;
};

export const TextField: React.FC<Props> = ({ field, value, onChange }) => {
  const inputId = `ab-field-${field.id}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const commonInputProps = {
    id: inputId,
    className: "ab-input",
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    required: field.required,
    "aria-describedby": helpId,
  };

  return (
    <div className="ab-field">
      <label className="ab-label" htmlFor={inputId}>
        {field.label}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          {...commonInputProps}
          className="ab-textarea"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...commonInputProps}
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.helpText && (
        <div id={helpId} className="ab-help">
          {field.helpText}
        </div>
      )}
    </div>
  );
};
