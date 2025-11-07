import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EntryForm } from "../EntryForm";
import type { FormSchema, FileRef } from "../../model/form";
import type { UploadAdapter } from "../../lib/uploads";

const schema: FormSchema = {
  id: "validate-rows@1",
  title: "Data Validation",
  fields: [
    { id: "f1", name: "concurrency", label: "Concurrency", kind: "number", min: 1, max: 256 },
    { id: "f2", name: "upload_to_sharepoint", label: "Upload to SharePoint", kind: "checkbox" },
    {
      id: "f3",
      name: "uploaded_file",
      label: "Excel",
      kind: "file",
      accept: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      maxSizeMB: 10,
    },
  ],
};

const fileRef: FileRef = {
  file_id: "file_abc123",
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  display_name: "input.xlsx",
  size: 2048,
};

const makeUploader = (): UploadAdapter => ({
  upload: vi.fn(async () => fileRef),
});

describe("EntryForm", () => {
  it("submits values, message, and collected file refs", () => {
    const onSubmit = vi.fn();
    const uploader = makeUploader();

    render(
      <EntryForm
        schema={schema}
        withMessages
        onSubmit={onSubmit}
        uploader={uploader}
        initialValues={{ uploaded_file: fileRef }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Type a message."), {
      target: { value: "Validate this" },
    });

    fireEvent.change(screen.getByLabelText("Concurrency"), { target: { value: "8" } });
    fireEvent.click(screen.getByLabelText("Upload to SharePoint"));
    fireEvent.click(screen.getByText("Execute"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.messages?.[0].content).toBe("Validate this");
    expect(payload.form.values.concurrency).toBe("8");
    expect(payload.form.values.upload_to_sharepoint).toBe(true);
    expect(payload.files?.[0]).toEqual(fileRef);
  });
});
