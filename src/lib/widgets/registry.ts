import { ReactNode } from "react";

export type WidgetEnvelope = {
  kind: string;
  id?: string; // optional stable id to support fine-grained merges
  version?: string;
  props?: Record<string, any>;
};

export type WidgetComponentProps = {
  props?: Record<string, any>;
};

export type WidgetComponent = (p: WidgetComponentProps) => ReactNode;

export type WidgetRegistration = {
  component: WidgetComponent;
  fallback?: boolean; // mark a safe default fallback
};

const REGISTRY = new Map<string, WidgetRegistration>();

export function registerWidget(kind: string, component: WidgetComponent, opts?: { fallback?: boolean }) {
  REGISTRY.set(kind, { component, fallback: !!opts?.fallback });
}

export function getWidget(kind: string): WidgetRegistration | undefined {
  return REGISTRY.get(kind);
}

export function listWidgets(): string[] {
  return Array.from(REGISTRY.keys());
}

// Default fallback (plain text renderer can attach here later if desired)
export function getFallback(): WidgetRegistration | undefined {
  for (const [, reg] of REGISTRY) {
    if (reg.fallback) return reg;
  }
  return undefined;
}
