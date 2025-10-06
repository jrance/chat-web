import type { FC } from "react";
import type { ChatTurn } from "./model/types";

type RendererModule = { default: Renderer };

export type Renderer = FC<{ turn: ChatTurn }>;

const registry = new Map<string, () => Promise<RendererModule>>();

export function registerRenderer(schemaId: string, loader: () => Promise<RendererModule>) {
  registry.set(schemaId, loader);
}

export async function loadRenderer(schemaId?: string): Promise<Renderer | null> {
  if (!schemaId) return null;
  const loader = registry.get(schemaId);
  if (!loader) return null;
  const module = await loader();
  return module.default;
}

// bootstrap default registrations here or in app init:
registerRenderer("policy.answer@1.0.0", () => import("./renderers/policyAnswer"));
