import { WidgetEnvelope } from "./registry";

// Merge new envelopes into existing array (by kind+id). Shallow-merge props.
export function mergeEnvelopes(existing: WidgetEnvelope[], incoming?: WidgetEnvelope | WidgetEnvelope[]): WidgetEnvelope[] {
  if (!incoming) return existing;
  const arr = Array.isArray(incoming) ? incoming : [incoming];
  const out = [...existing];
  for (const env of arr) {
    const key = env.id ? `${env.kind}:${env.id}` : `${env.kind}`;
    const idx = out.findIndex(e => (e.id ? `${e.kind}:${e.id}` : e.kind) === key);
    if (idx === -1) {
      out.push(env);
    } else {
      out[idx] = { ...out[idx], ...env, props: { ...(out[idx].props || {}), ...(env.props || {}) } };
    }
  }
  return out;
}
