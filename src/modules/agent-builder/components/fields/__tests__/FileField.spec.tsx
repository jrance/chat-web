import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileField } from "../FileField";
import type { FileField as FileFieldT, FileRef } from "../../../model/form";

const createFile = (name: string, type: string, size = 1024) =>
  new File([new Array(size).fill("a").join("")], name, { type });

describe("FileField", () => {
  it("uploads valid files and lists them", async () => {
    const field: FileFieldT = {
      id: "file-input",
      name: "uploaded_file",
      label: "Excel",
      kind: "file",
      accept: ["text/plain"],
      maxSizeMB: 5,
    };
    const uploaded: FileRef = {
      file_id: "file1",
      mime_type: "text/plain",
      display_name: "a.txt",
      size: 1024,
    };
    const onChange = vi.fn();
    const uploader = { upload: vi.fn(async () => uploaded) };

    render(<FileField field={field} value={null} onChange={onChange} uploader={uploader} />);

    const dropzone = screen.getByRole("button", { name: /dropzone/i });
    const file = createFile("a.txt", "text/plain");
    const dataTransfer = { files: [file] } as DataTransfer;

    fireEvent.drop(dropzone, { dataTransfer });

    await waitFor(() => expect(uploader.upload).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(uploaded);
    expect(screen.getByText("a.txt")).toBeInTheDocument();
  });

  it("rejects unsupported MIME types", async () => {
    const field: FileFieldT = {
      id: "file-input",
      name: "uploaded_file",
      label: "Excel",
      kind: "file",
      accept: ["text/plain"],
    };
    const onChange = vi.fn();
    const uploader = { upload: vi.fn() };
    render(<FileField field={field} value={null} onChange={onChange} uploader={uploader} />);

    const dropzone = screen.getByRole("button", { name: /dropzone/i });
    const file = createFile("a.bin", "application/octet-stream");
    const dataTransfer = { files: [file] } as DataTransfer;
    fireEvent.drop(dropzone, { dataTransfer });

    await waitFor(() => {
      expect(uploader.upload).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("Unsupported type");
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
