import React from "react";
import type { DateTimeField as DateTimeFieldT } from "../../model/form";

type Props = {
  field: DateTimeFieldT;
  value?: string;
  onChange: (value: string) => void;
};

export const DateTimeField: React.FC<Props> = ({ field, value, onChange }) => {
  const inputId = `ab-field-${field.id}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;

  return (
    <div className="ab-field">
      <label className="ab-label" htmlFor={inputId}>
        {field.label}
      </label>
      <input
        id={inputId}
        className="ab-input"
        type="datetime-local"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-describedby={helpId}
      />
      {field.helpText && (
        <div id={helpId} className="ab-help">
          {field.helpText}
        </div>
      )}
    </div>
  );
};
