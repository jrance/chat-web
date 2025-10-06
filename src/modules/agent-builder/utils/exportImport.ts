import { IRGraph } from "../model/ir";

export function serializeIR(ir: IRGraph): string {
  return JSON.stringify(ir, null, 2);
}

export function parseIR(text: string): IRGraph {
  return JSON.parse(text) as IRGraph;
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function loadFromLocalStorage(key: string): IRGraph | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IRGraph;
  } catch {
    return null;
  }
}

export function saveToLocalStorage(key: string, ir: IRGraph) {
  localStorage.setItem(key, serializeIR(ir));
}

