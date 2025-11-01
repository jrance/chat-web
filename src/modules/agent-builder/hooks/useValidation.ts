import { useCallback, useMemo, useState } from "react";
import Ajv2020, { ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import irSchema from "../model/schemas/ir.schema.json";
import a2aSchema from "../model/schemas/a2a.schema.json";
import byoeSchema from "../model/schemas/byoe.schema.json";
import { IRGraph } from "../model/ir";
import { listChildren } from "../utils/graph";
import { useAgentStudio } from "../providers/AgentStudioProvider";

export type ValidationIssue = {
  path: string;
  message: string;
  severity: "error" | "warning";
};

export function useValidation() {
  const ajv = useMemo(() => {
    const instance = new Ajv2020({ allErrors: true, strict: false });
    addFormats(instance);
    instance.addSchema(a2aSchema);
    instance.addSchema(byoeSchema);
    return instance;
  }, []);

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const { toolsIndex } = useAgentStudio();

  const computeIssues = useCallback(
    (ir: IRGraph): ValidationIssue[] => {
      const validate = ajv.compile(irSchema);
      const ok = validate(ir);
      const errs: ValidationIssue[] = [];
      if (!ok && validate.errors) {
        errs.push(...normalizeErrors(validate.errors, ir));
      }
      errs.push(...graphRules(ir, toolsIndex));
      return errs;
    },
    [ajv, toolsIndex]
  );

  const validateIR = useCallback(
    (ir: IRGraph): ValidationIssue[] => {
      const errs = computeIssues(ir);
      // Only update state if changed to avoid render loops
      const same = errs.length === issues.length && errs.every((e, i) => e.path === issues[i]?.path && e.message === issues[i]?.message && e.severity === issues[i]?.severity);
      if (!same) setIssues(errs);
      return errs;
    },
    [computeIssues, issues]
  );

  return { computeIssues, validateIR, issues };
}

function normalizeErrors(errors: ErrorObject[], ir: IRGraph): ValidationIssue[] {
  const kindMap: Record<string, string> = {
    RouterNode: "router",
    SequentialNode: "sequential",
    ConcurrentNode: "concurrent",
    GroupChatNode: "groupchat",
    CodelessAgentNode: "agent.codeless",
    BYOEAgentNode: "agent.byoe",
    RemoteAgentNode: "agent.remote",
    ToolNode: "tool",
    MCPServerNode: "mcpServer",
    OutputNode: "output",
  };
  const filtered: ValidationIssue[] = [];
  for (const e of errors) {
    const ip = e.instancePath || "";
    const kw = (e as any).keyword as string | undefined;
    const sp = (e as any).schemaPath as string | undefined;
    const missingProp: string | undefined = (e as any).params && (e as any).params.missingProperty;
    // Suppress branch noise
    if (kw === "const" || kw === "enum" || kw === "oneOf") continue;
    // Suppress non-node/edge top-level required
    if (kw === "required" && !ip.includes("/nodes/") && !ip.includes("/edges/")) continue;
    // Suppress required at node root (usually other branch requirements)
    if (kw === "required" && /^\/nodes\/\d+$/.test(ip)) continue;
    // Suppress required errors from schema branches that don't match the node's kind
    if (kw === "required" && sp) {
      const m = sp.match(/\$defs\/(\w+)/);
      if (m && m[1] && kindMap[m[1]]) {
        // Extract node index if present
        const mIdx = ip.match(/^\/nodes\/(\d+)/);
        if (mIdx) {
          const idx = Number(mIdx[1]);
          const node = ir.nodes[idx] as any;
          if (node && node.kind && node.kind !== kindMap[m[1]]) {
            continue; // error from wrong branch
          }
        }
      }
    }
    // Additional guard: for known required properties that belong to specific kinds, drop when node kind differs
    if (kw === "required" && missingProp) {
      const mIdx = ip.match(/^\/nodes\/(\d+)/);
      if (mIdx) {
        const idx = Number(mIdx[1]);
        const node = ir.nodes[idx] as any;
        const propToKinds: Record<string, string[]> = {
          routeSchema: ["router"],
          minConfidence: ["router"],
          prompt: ["router"],
          name: ["tool"],
          url: ["mcpServer"],
          protocol: ["mcpServer"],
        };
        const allowed = propToKinds[missingProp];
        if (allowed && node?.kind && !allowed.includes(node.kind)) {
          continue;
        }
      }
    }
    filtered.push({ path: ip || sp || "#", message: e.message || "Invalid", severity: "error" });
  }
  // Deduplicate by path+message
  const out: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const i of filtered) {
    const k = `${i.path}|${i.message}`;
    if (!seen.has(k)) { seen.add(k); out.push(i); }
  }
  return out;
}

function graphRules(ir: IRGraph, toolsIndex?: Record<string, any>): ValidationIssue[] {
  const list: ValidationIssue[] = [];

  // No orphans: reachable from entryId if present
  if (ir.entryId) {
    const visited = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const n of ir.nodes) adj.set(n.id, []);
    for (const e of ir.edges) {
      adj.get(e.from)?.push(e.to);
    }
    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const v of adj.get(id) ?? []) dfs(v);
    };
    dfs(ir.entryId);
    for (const n of ir.nodes) {
      if (!visited.has(n.id)) {
        list.push({ path: `/nodes/${n.id}`, message: `Orphan node: ${n.label}` });
      }
    }
  }
  
  // Router rules: minConfidence in [0,1] and enum equals child labels
  for (const n of ir.nodes) {
    if (n.kind === "router") {
      const childEdges = ir.edges.filter((e) => e.from === n.id);
      if (childEdges.length < 1) list.push({ path: `/nodes/${n.id}`, message: "Router must have at least one outgoing edge", severity: "error" });
      const childNodeLabels = ir.nodes.filter((m) => childEdges.some((e) => e.to === m.id)).map((m) => m.label);
      const enumVals = (n.data.routeSchema?.properties as any)?.target?.enum as string[] | undefined;
      if (!n.data.routeSchema) {
        list.push({ path: `/nodes/${n.id}/data/routeSchema`, message: "routeSchema is required", severity: "error" });
      } else if (enumVals && JSON.stringify(enumVals) !== JSON.stringify(childNodeLabels)) {
        list.push({ path: `/nodes/${n.id}/data/routeSchema/properties/target/enum`, message: "Router enum must match child labels", severity: "error" });
      }
      if (n.data.minConfidence != null) {
        const v = n.data.minConfidence;
        if (v < 0 || v > 1) list.push({ path: `/nodes/${n.id}/data/minConfidence`, message: "minConfidence must be within [0,1]", severity: "error" });
      }
      // Duplicate child labels under this router (block)
      const dupes = new Set<string>();
      const seen = new Set<string>();
      for (const l of childNodeLabels) {
        if (seen.has(l)) dupes.add(l);
        seen.add(l);
      }
      if (dupes.size > 0) list.push({ path: `/nodes/${n.id}`, message: `Duplicate child labels: ${Array.from(dupes).join(", ")}`, severity: "error" });
      // Fallback default child validation
      if (n.data.fallback?.mode === "DefaultChild") {
        const dc = n.data.fallback?.defaultChild;
        if (!dc || !childNodeLabels.includes(dc)) list.push({ path: `/nodes/${n.id}/data/fallback/defaultChild`, message: "DefaultChild must be one of current children", severity: "error" });
      }
      // Prompt warning
      const prompt = n.data.prompt || "";
      if (prompt.length < 20) list.push({ path: `/nodes/${n.id}/data/prompt`, message: "Prompt is short (<20 chars)", severity: "warning" });
      // Tie-break PreferList warnings
      if (n.data.tieBreak === "PreferList") {
        const pref = n.data.tieBreakPrefer || [];
        if (pref.length === 0) list.push({ path: `/nodes/${n.id}/data/tieBreakPrefer`, message: "PreferList is empty", severity: "warning" });
        if (pref.some((p) => !childNodeLabels.includes(p))) list.push({ path: `/nodes/${n.id}/data/tieBreakPrefer`, message: "PreferList contains non-children", severity: "warning" });
      }
      // Edge label hint warnings when using target==ChildLabel
      for (const e of childEdges) {
        if (e.label && e.label.startsWith("target==")) {
          const value = e.label.substring("target==".length);
          if (!childNodeLabels.includes(value)) list.push({ path: `/edges/${e.id}/label`, message: `Edge label target does not match any child: ${value}`, severity: "warning" });
        }
      }
      // Limits
      if (childNodeLabels.length > 32) list.push({ path: `/nodes/${n.id}`, message: "Router has more than 32 children", severity: "warning" });
      const enumLen = (enumVals || []).reduce((acc, s) => acc + s.length, 0);
      if (enumLen > 4096) list.push({ path: `/nodes/${n.id}/data/routeSchema/properties/target/enum`, message: "Target enum total length > 4KB", severity: "warning" });
    }
  }

  // Orchestration nodes must have ≥1 child
  for (const n of ir.nodes) {
    if (["sequential", "concurrent", "groupchat"].includes(n.kind)) {
      const childEdges = ir.edges.filter((e) => e.from === n.id);
      if (childEdges.length < 1) list.push({ path: `/nodes/${n.id}`, message: `${n.kind} must have at least one child` });
    }
  }

  // Concurrent merge.synthPrompt required if Synthesize
  for (const n of ir.nodes) {
    if (n.kind === "concurrent" && n.data.merge?.strategy === "Synthesize" && !n.data.merge.synthPrompt) {
      list.push({ path: `/nodes/${n.id}/data/merge/synthPrompt`, message: "synthPrompt is required for Synthesize" });
    }
  }

  // Remote agent required fields
  for (const n of ir.nodes) {
    if (n.kind === "agent.remote") {
      const d = n.data as any;
      if (!d.endpoint) list.push({ path: `/nodes/${n.id}/data/endpoint`, message: "endpoint is required" });
      if (!d.auth?.type) list.push({ path: `/nodes/${n.id}/data/auth/type`, message: "auth.type is required" });
      if (!d.responsePointer) list.push({ path: `/nodes/${n.id}/data/responsePointer`, message: "responsePointer is required" });
    }
  }

  // BYOE required combinations enforced by schema, but add friendly messages
  for (const n of ir.nodes) {
    if (n.kind === "agent.byoe") {
      const d = n.data as any;
      if (d?.routing?.selector === "topic" && !d?.routing?.commandsTopic) list.push({ path: `/nodes/${n.id}/data/routing/commandsTopic`, message: "commandsTopic is required when selector is topic" });
      if (d?.routing?.selector === "header" && (!d?.routing?.headerKey || !d?.routing?.headerValue)) list.push({ path: `/nodes/${n.id}/data/routing`, message: "headerKey and headerValue are required when selector is header" });
    }
  }

  // Tool name
  for (const n of ir.nodes) {
    if (n.kind === "tool") {
      const d = n.data as any;
      if (!d?.name) list.push({ path: `/nodes/${n.id}/data/name`, message: "Tool name is required", severity: "error" });
    }
  }

  // Codeless Agent validations
  for (const n of ir.nodes) {
    if (n.kind === "agent.codeless") {
      const d = n.data as any;
      // Instructions required
      if (!d?.systemInstructions || d.systemInstructions.trim().length === 0) {
        list.push({ path: `/nodes/${n.id}/data/systemInstructions`, message: "System Instructions are required", severity: "error" });
      }
      // Model provider/modelId required
      if (!d?.model?.provider) list.push({ path: `/nodes/${n.id}/data/model/provider`, message: "Model provider is required", severity: "error" });
      if (!d?.model?.modelId) list.push({ path: `/nodes/${n.id}/data/model/modelId`, message: "Model ID is required", severity: "error" });
      // Temperature range
      const temp = d?.model?.temperature;
      if (temp != null && (temp < 0 || temp > 2)) list.push({ path: `/nodes/${n.id}/data/model/temperature`, message: "Temperature must be in [0,2]", severity: "error" });
      // topP range (0,1]
      const topP = d?.model?.topP;
      if (topP != null && (topP <= 0 || topP > 1)) list.push({ path: `/nodes/${n.id}/data/model/topP`, message: "TopP must be in (0,1]", severity: "error" });
      // Structured output schema if enabled
      if (d?.structuredOutput?.enabled && !d?.structuredOutput?.schema) {
        list.push({ path: `/nodes/${n.id}/data/structuredOutput/schema`, message: "Structured Output schema required when enabled", severity: "error" });
      }
      // Attached tools validation no longer requires argsSchema
      // History window N
      if (d?.context?.historyWindow?.mode === "LastN" && d?.context?.historyWindow?.n != null && d.context.historyWindow.n < 0) {
        list.push({ path: `/nodes/${n.id}/data/context/historyWindow/n`, message: "HistoryWindow N must be >= 0", severity: "error" });
      }
      if (d?.context?.historyWindow?.mode === "TimeBounded") {
        const dm = d?.context?.historyWindow?.durationMs;
        if (dm == null || dm <= 0) {
          list.push({ path: `/nodes/${n.id}/data/context/historyWindow/durationMs`, message: "TimeBounded requires a positive duration", severity: "error" });
        }
      }
      // Tools bindings removed after merge: overrides now live on Tool nodes
    }
    if (n.kind === "tool") {
      const toolId = (n as any).data?.toolId as string | undefined;
      if (!toolId) {
        list.push({ path: `/nodes/${n.id}/data/toolId`, message: "Tool not selected", severity: "error" });
      } else {
        try {
          const def = (toolsIndex || {})[toolId];
          if (!def) {
            list.push({ path: `/nodes/${n.id}/data/toolId`, message: "Tool not found", severity: "error" });
          } else {
            const params = def.parameters || [];
            const overrides = ((n as any).data?.parameterOverrides as any) || {};
            for (const key of Object.keys(overrides)) {
              const p = params.find((x: any) => x.name === key);
              if (!p) continue;
              const v = overrides[key];
              if (p.scope === "OrgLocked") {
                list.push({ path: `/nodes/${n.id}/data/parameterOverrides/${key}`, message: `Override not allowed for OrgLocked parameter: ${key}`, severity: "error" });
                continue;
              }
              const t = p.type as string;
              const typeOk =
                (t === "string" && typeof v === "string") ||
                (t === "number" && typeof v === "number") ||
                (t === "boolean" && typeof v === "boolean") ||
                (t === "enum" && typeof v === "string" && (!p.enum || p.enum.includes(v))) ||
                (t === "array<string>" && Array.isArray(v) && v.every((item) => typeof item === "string")) ||
                (t === "array<number>" && Array.isArray(v) && v.every((item) => typeof item === "number"));
              if (!typeOk) list.push({ path: `/nodes/${n.id}/data/parameterOverrides/${key}`, message: `Invalid override type/value for ${key}`, severity: "error" });
              if (t === "number") {
                if ((p.min != null && v < p.min) || (p.max != null && v > p.max)) {
                  list.push({ path: `/nodes/${n.id}/data/parameterOverrides/${key}`, message: `${key} must be between ${p.min} and ${p.max}`, severity: "error" });
                }
              }
            }
          }
        } catch {}
      }
    }
    if (n.kind === "mcpServer") {
      const d: any = (n as any).data || {};
      if (!d.url || typeof d.url !== "string" || d.url.trim().length === 0) list.push({ path: `/nodes/${n.id}/data/url`, message: "URL is required", severity: "error" });
      if (!d.protocol || typeof d.protocol !== "string" || d.protocol.trim().length === 0) list.push({ path: `/nodes/${n.id}/data/protocol`, message: "Protocol is required", severity: "error" });
      const at = String(d.auth?.type || "").toLowerCase();
      if (at === "obo") {
        const scopes = d.auth?.scopes || [];
        if (!Array.isArray(scopes) || scopes.length === 0) list.push({ path: `/nodes/${n.id}/data/auth/scopes`, message: "OBO requires at least one scope", severity: "error" });
      }
      if (["api_key", "client_credentials", "mtls"].includes(at)) {
        const sec = d.auth?.secretRef;
        if (!sec) list.push({ path: `/nodes/${n.id}/data/auth/secretRef`, message: `${d.auth?.type} requires a SecretRef`, severity: "error" });
      }
    }
    if (n.kind === "sequential") {
      const children = listChildren(ir, n.id);
      if (children.length < 1) list.push({ path: `/nodes/${n.id}`, message: "Sequential requires ≥1 child", severity: "error" });
      const overrides: any = (n as any).data?.childOverrides || {};
      const allDisabled = children.length > 0 && children.every((c) => (overrides[c.id]?.enabled ?? true) === false);
      if (allDisabled) list.push({ path: `/nodes/${n.id}`, message: "At least one child must be enabled", severity: "error" });
      if ((n as any).data?.breakOn === "HighConfidence") {
        const anyMin = children.some((c) => typeof overrides[c.id]?.minConfidence === "number");
        if (!anyMin) list.push({ path: `/nodes/${n.id}`, message: "HighConfidence set without any per-child minConfidence", severity: "warning" });
      }
      // Duplicate child labels warning
      const labels = new Map<string, number>();
      for (const c of children) labels.set(c.label, (labels.get(c.label) || 0) + 1);
      const dups = Array.from(labels.entries()).filter(([, cnt]) => cnt > 1).map(([l]) => l);
      if (dups.length > 0) list.push({ path: `/nodes/${n.id}`, message: `Duplicate child labels: ${dups.join(", ")}`, severity: "warning" });
    }
    if (n.kind === "concurrent") {
      const d: any = (n as any).data || {};
      const children = listChildren(ir, n.id);
      if (children.length < 1) list.push({ path: `/nodes/${n.id}`, message: "Concurrent requires ≥1 child", severity: "error" });
      const overrides: any = d.childOverrides || {};
      const allDisabled = children.length > 0 && children.every((c) => (overrides[c.id]?.enabled ?? true) === false);
      if (allDisabled) list.push({ path: `/nodes/${n.id}`, message: "At least one child must be enabled", severity: "error" });
      const strat = d.merge?.strategy;
      if (strat === "Synthesize" && !d.merge?.synthPrompt) list.push({ path: `/nodes/${n.id}/data/merge/synthPrompt`, message: "Synth Prompt is required for Synthesize", severity: "error" });
      if (strat === "HighestScore" && !d.merge?.scoreField) list.push({ path: `/nodes/${n.id}/data/merge/scoreField`, message: "Score Field is required for HighestScore", severity: "error" });
      if (strat === "FirstBest" && !d.merge?.acceptRule) list.push({ path: `/nodes/${n.id}/data/merge/acceptRule`, message: "Acceptance Rule is required for FirstBest", severity: "error" });
      if (d.timeoutSec == null || d.timeoutSec <= 0) list.push({ path: `/nodes/${n.id}/data/timeoutSec`, message: "Timeout must be > 0", severity: "error" });
      if (d.maxParallelism == null || d.maxParallelism < 1) list.push({ path: `/nodes/${n.id}/data/maxParallelism`, message: "Max Parallelism must be ≥ 1", severity: "error" });
      // warnings
      for (const c of children) {
        const w = overrides[c.id]?.weight;
        if (w != null && w <= 0) list.push({ path: `/nodes/${n.id}/data/childOverrides/${c.id}/weight`, message: `Weight ≤ 0 for ${c.label}`, severity: "warning" });
      }
      const enabledCount = children.filter((c) => (overrides[c.id]?.enabled ?? true) !== false).length;
      if (d.maxParallelism != null && enabledCount > d.maxParallelism) list.push({ path: `/nodes/${n.id}/data/maxParallelism`, message: "Max Parallelism less than enabled children (may queue)", severity: "warning" });
      if (d.timeoutSec != null && d.timeoutSec < 5) list.push({ path: `/nodes/${n.id}/data/timeoutSec`, message: "Timeout is very low (<5s)", severity: "warning" });
    }
  }

  return list;
}
