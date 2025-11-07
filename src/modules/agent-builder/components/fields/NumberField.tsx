import React from "react";
import type { NumberField as NumberFieldT } from "../../model/form";

type Props = {
  field: NumberFieldT;
  value?: string | number;
  onChange: (value: string | undefined) => void;
};

export const NumberField: React.FC<Props> = ({ field, value, onChange }) => {
  const inputId = `ab-field-${field.id}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === "") {
      onChange(undefined);
      return;
    }
    onChange(raw);
  };

  return (
    <div className="ab-field">
      <label className="ab-label" htmlFor={inputId}>
        {field.label}
      </label>
      <input
        id={inputId}
        className="ab-input"
        type="number"
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={
          value === undefined || value === null
            ? ""
            : typeof value === "number"
              ? String(value)
              : value
        }
        onChange={handleChange}
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
