import React from "react";
import type { CheckboxField as CheckboxFieldT } from "../../model/form";

type Props = {
  field: CheckboxFieldT;
  value?: boolean;
  onChange: (value: boolean) => void;
};

export const CheckboxField: React.FC<Props> = ({ field, value, onChange }) => {
  const inputId = `ab-field-${field.id}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;

  return (
    <div className="ab-field">
      <label className="ab-checkbox" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={value ?? field.defaultChecked ?? false}
          onChange={(event) => onChange(event.target.checked)}
          required={field.required}
          aria-describedby={helpId}
        />
        {field.label}
      </label>
      {field.helpText && (
        <div id={helpId} className="ab-help">
          {field.helpText}
        </div>
      )}
    </div>
  );
};
