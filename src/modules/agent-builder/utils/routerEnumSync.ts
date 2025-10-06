import { IRGraph, RouterNode } from "../model/ir";
import { listChildren } from "./graph";

export function syncRouterEnum(ir: IRGraph, routerId: string): IRGraph {
  const router = ir.nodes.find((n) => n.id === routerId && n.kind === "router") as RouterNode | undefined;
  if (!router) return ir;
  const childNodes = listChildren(ir, routerId);
  const targets = childNodes.map((c) => c.label);

  const current = (router.data.routeSchema ?? {}) as Record<string, any>;
  const properties = {
    ...(current.properties || {}),
    target: { type: "string", enum: targets },
    confidence: current.properties?.confidence || { type: "number", minimum: 0, maximum: 1 },
  };
  const required = Array.isArray(current.required) ? Array.from(new Set(["target", ...current.required])) : ["target"];
  const routeSchema = { ...current, type: "object", properties, required };

  const updatedRouter: RouterNode = {
    ...router,
    data: {
      ...router.data,
      targets,
      routeSchema,
    },
  };

  return {
    ...ir,
    nodes: ir.nodes.map((n) => (n.id === routerId ? (updatedRouter as any) : n)),
  };
}
