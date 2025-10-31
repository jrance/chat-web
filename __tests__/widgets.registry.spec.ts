import { describe, it, expect } from "vitest";
import { registerWidget, getWidget, listWidgets, getFallback } from "../src/lib/widgets/registry";

describe("Widget Registry", () => {
  it("should register a widget", () => {
    const component = () => "test";
    registerWidget("test-widget-unique-1", component);
    
    const registration = getWidget("test-widget-unique-1");
    expect(registration).toBeDefined();
    expect(registration?.component).toBe(component);
    expect(registration?.fallback).toBe(false);
  });

  it("should register a fallback widget", () => {
    const component = () => "fallback";
    registerWidget("fallback-widget-unique", component, { fallback: true });
    
    const registration = getWidget("fallback-widget-unique");
    expect(registration?.fallback).toBe(true);
  });

  it("should return undefined for unknown widget", () => {
    const registration = getWidget("unknown-widget-that-does-not-exist");
    expect(registration).toBeUndefined();
  });

  it("should list all registered widgets", () => {
    const beforeCount = listWidgets().length;
    registerWidget("widget1-unique", () => "1");
    registerWidget("widget2-unique", () => "2");
    
    const widgets = listWidgets();
    expect(widgets).toContain("widget1-unique");
    expect(widgets).toContain("widget2-unique");
    expect(widgets.length).toBeGreaterThanOrEqual(beforeCount + 2);
  });

  it("should return a fallback widget when one is registered", () => {
    // The builtin "error" widget is registered as fallback in main.tsx
    const fallback = getFallback();
    expect(fallback).toBeDefined();
    expect(fallback?.fallback).toBe(true);
  });

  it("should override existing widget on re-registration", () => {
    const component1 = () => "first";
    const component2 = () => "second";
    
    registerWidget("widget-override-test", component1);
    registerWidget("widget-override-test", component2);
    
    const registration = getWidget("widget-override-test");
    expect(registration?.component).toBe(component2);
  });
});
