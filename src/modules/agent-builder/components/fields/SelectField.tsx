import React from "react";
import type { SelectField as SelectFieldT } from "../../model/form";

type Props = {
  field: SelectFieldT;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
};

export const SelectField: React.FC<Props> = ({ field, value, onChange }) => {
  const inputId = `ab-field-${field.id}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (field.multiple) {
      const values = Array.from(event.target.selectedOptions).map((option) => option.value);
      onChange(values);
    } else {
      onChange(event.target.value);
    }
  };

  return (
    <div className="ab-field">
      <label className="ab-label" htmlFor={inputId}>
        {field.label}
      </label>
      <select
        id={inputId}
        className="ab-select"
        multiple={!!field.multiple}
        value={
          field.multiple
            ? ((value as string[] | undefined) ?? [])
            : ((value as string | undefined) ?? "")
        }
        onChange={handleChange}
        required={field.required}
        aria-describedby={helpId}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.helpText && (
        <div id={helpId} className="ab-help">
          {field.helpText}
        </div>
      )}
    </div>
  );
};
