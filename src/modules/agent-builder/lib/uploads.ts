import type { FileRef, FormValues } from "../model/form";

export type UploadResult = FileRef;
export type UploadFn = (file: File) => Promise<UploadResult>;

export interface UploadAdapter {
  upload: UploadFn;
}

export function createFetchUploadAdapter(opts: {
  endpoint: string;
  headers?: Record<string, string>;
}): UploadAdapter {
  return {
    async upload(file: File): Promise<UploadResult> {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(opts.endpoint, {
        method: "POST",
        headers: opts.headers,
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }
      const data = (await res.json()) as UploadResult;
      return data;
    },
  };
}

export function collectFileRefs(values: FormValues): FileRef[] {
  const refs: FileRef[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      const maybe = value as Partial<FileRef>;
      if (maybe.file_id && maybe.mime_type && maybe.display_name) {
        refs.push(maybe as FileRef);
        return;
      }
      Object.values(value).forEach(visit);
    }
  };

  visit(values);
  return refs;
}
