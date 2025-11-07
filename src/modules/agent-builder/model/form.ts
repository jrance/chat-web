export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "datetime"
  | "file";

export type Option = { value: string; label: string };

export type BaseField = {
  id: string;
  name: string;
  label: string;
  helpText?: string;
  required?: boolean;
  hidden?: boolean;
};

export type TextField = BaseField & {
  kind: "text" | "textarea";
  placeholder?: string;
  maxLength?: number;
};

export type NumberField = BaseField & {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
};

export type SelectField = BaseField & {
  kind: "select";
  options: Option[];
  multiple?: boolean;
};

export type CheckboxField = BaseField & {
  kind: "checkbox";
  defaultChecked?: boolean;
};

export type DateTimeField = BaseField & {
  kind: "datetime";
};

export type FileField = BaseField & {
  kind: "file";
  multiple?: boolean;
  accept?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
};

export type Field =
  | TextField
  | NumberField
  | SelectField
  | CheckboxField
  | DateTimeField
  | FileField;

export type FormSchema = {
  id: string;
  title?: string;
  fields: Field[];
};

export type FileRef = {
  file_id: string;
  mime_type: string;
  display_name: string;
  size?: number;
};

export type FormValues = Record<string, unknown>;

export type EntryOutputs = {
  messages?: Array<{ role: "user" | "system" | "assistant"; content: unknown }>;
  form: { values: FormValues };
  files?: FileRef[];
};
