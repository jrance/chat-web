import { registerWidget } from "./registry";
import CitationList from "./builtin/CitationList";
import ToolResult from "./builtin/ToolResult";
import KeyValuePairs from "./builtin/KeyValuePairs";
import SimpleTable from "./builtin/SimpleTable";
import CodeBlock from "./builtin/CodeBlock";
import ErrorCallout from "./builtin/ErrorCallout";

export function registerBuiltins() {
  registerWidget("citation-list", CitationList);
  registerWidget("tool-result", ToolResult);
  registerWidget("key-value", KeyValuePairs);
  registerWidget("table", SimpleTable);
  registerWidget("code", CodeBlock);
  registerWidget("error", ErrorCallout, { fallback: true }); // safe default
}

// Re-export registry functions for convenience
export { registerWidget, getWidget, listWidgets, getFallback } from "./registry";
export { WidgetHost } from "./host";
export { mergeEnvelopes } from "./merge";
export type { WidgetEnvelope, WidgetComponent, WidgetComponentProps, WidgetRegistration } from "./registry";
