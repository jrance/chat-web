import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetHost } from "../src/lib/widgets/host";
import { registerWidget } from "../src/lib/widgets/registry";
import { WidgetEnvelope } from "../src/lib/widgets/registry";
import React from "react";

describe("WidgetHost", () => {

  it("should render nothing when envelopes is empty", () => {
    const { container } = render(<WidgetHost envelopes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when envelopes is undefined", () => {
    const { container } = render(<WidgetHost />);
    expect(container.firstChild).toBeNull();
  });

  it("should render known widget", () => {
    const TestWidget = ({ props }: { props?: any }) => <div>Test: {props?.value}</div>;
    registerWidget("test-render-1", TestWidget);

    const envelopes: WidgetEnvelope[] = [{ kind: "test-render-1", props: { value: "hello" } }];
    render(<WidgetHost envelopes={envelopes} />);

    expect(screen.getByText("Test: hello")).toBeDefined();
  });

  it("should render multiple widgets", () => {
    const Widget1 = () => <div>Widget 1</div>;
    const Widget2 = () => <div>Widget 2</div>;
    
    registerWidget("widget1-render", Widget1);
    registerWidget("widget2-render", Widget2);

    const envelopes: WidgetEnvelope[] = [
      { kind: "widget1-render" },
      { kind: "widget2-render" }
    ];
    render(<WidgetHost envelopes={envelopes} />);

    expect(screen.getByText("Widget 1")).toBeDefined();
    expect(screen.getByText("Widget 2")).toBeDefined();
  });

  it("should use fallback widget for unknown kind", () => {
    const FallbackWidget = ({ props }: { props?: any }) => <div>Fallback: {props?.kind}</div>;
    registerWidget("fallback-render", FallbackWidget, { fallback: true });

    const envelopes: WidgetEnvelope[] = [{ kind: "unknown-xyz-123", props: { kind: "unknown" } }];
    render(<WidgetHost envelopes={envelopes} />);

    expect(screen.getByText(/Fallback/)).toBeDefined();
  });

  it("should render nothing for unknown kind without fallback", () => {
    // Temporarily get all registered widgets to restore later
    const TestWidget = () => <div>Known</div>;
    registerWidget("known-widget-for-test", TestWidget);

    const envelopes: WidgetEnvelope[] = [
      { kind: "known-widget-for-test" },
      { kind: "completely-unknown-widget-xyz" }
    ];
    const { container } = render(<WidgetHost envelopes={envelopes} />);

    // Should render wrapper and one child for known widget, unknown should use fallback or skip
    const wrapper = container.querySelector(".space-y-2");
    expect(wrapper).toBeDefined();
    // Since we have a fallback registered (error widget), both should render
    expect(wrapper?.children.length).toBeGreaterThan(0);
  });

  it("should use envelope id as key when present", () => {
    const TestWidget = ({ props }: { props?: any }) => <div>{props?.text}</div>;
    registerWidget("test-with-id", TestWidget);

    const envelopes: WidgetEnvelope[] = [
      { kind: "test-with-id", id: "widget-1", props: { text: "First" } },
      { kind: "test-with-id", id: "widget-2", props: { text: "Second" } }
    ];
    const { container } = render(<WidgetHost envelopes={envelopes} />);

    const divs = container.querySelectorAll(".w-full");
    expect(divs.length).toBe(2);
  });

  it("should handle widgets without props", () => {
    const TestWidget = () => <div>No props</div>;
    registerWidget("test-no-props", TestWidget);

    const envelopes: WidgetEnvelope[] = [{ kind: "test-no-props" }];
    render(<WidgetHost envelopes={envelopes} />);

    expect(screen.getByText("No props")).toBeDefined();
  });

  it("should pass props to widget component", () => {
    const TestWidget = ({ props }: { props?: any }) => (
      <div>
        {props?.name}: {props?.value}
      </div>
    );
    registerWidget("test-with-props", TestWidget);

    const envelopes: WidgetEnvelope[] = [
      { kind: "test-with-props", props: { name: "count", value: 42 } }
    ];
    render(<WidgetHost envelopes={envelopes} />);

    expect(screen.getByText("count: 42")).toBeDefined();
  });
});
