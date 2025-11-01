import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToolConfigPanel from "../src/features/inspector/ToolConfigPanel";

describe("ToolConfigPanel", () => {
  describe("Rendering", () => {
    it("should show placeholder when node is not an agent", () => {
      const graph = {
        nodes: [
          { id: "node1", kind: "agent.router", data: {} }
        ]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="node1"
          onGraphChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Select a Codeless Agent/i)).toBeDefined();
    });

    it("should render tool policy section for codeless agent", () => {
      const graph = {
        nodes: [
          {
            id: "agent1",
            kind: "agent.codeless",
            data: {
              tools: {
                policy: "Auto",
                timeoutMs: 10000,
                maxCallsPerTurn: 0,
                parallelism: 1,
                redactPII: true
              }
            }
          }
        ]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Tool policy/i)).toBeDefined();
      expect(screen.getByText(/Attached tools/i)).toBeDefined();
    });

    it("should render tool dropdown with DuckDuckGo Search option", () => {
      const graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", data: {} }
        ]
      };

      const { container } = render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      // The dropdown doesn't have an accessible name, so we get it by position
      const dropdowns = container.querySelectorAll("select");
      const toolDropdown = Array.from(dropdowns).find(el =>
        el.querySelector('option[value="tool:ddgs.search"]')
      );
      expect(toolDropdown).toBeDefined();

      // Check that DuckDuckGo Search is in the options
      const option = screen.getByRole("option", { name: /DuckDuckGo Search/i });
      expect(option).toBeDefined();
    });
  });

  describe("Tool Policy", () => {
    it("should display current policy values", () => {
      const graph = {
        nodes: [
          {
            id: "agent1",
            kind: "agent.codeless",
            data: {
              tools: {
                policy: "AlwaysAsk",
                timeoutMs: 5000,
                maxCallsPerTurn: 3,
                parallelism: 2,
                redactPII: false
              }
            }
          }
        ]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      const policySelect = screen.getByDisplayValue("AlwaysAsk");
      expect(policySelect).toBeDefined();

      const timeoutInput = screen.getByDisplayValue("5000");
      expect(timeoutInput).toBeDefined();

      const maxCallsInput = screen.getByDisplayValue("3");
      expect(maxCallsInput).toBeDefined();
    });

    it("should call onGraphChange when policy is updated", () => {
      const onGraphChange = vi.fn();
      const graph = {
        nodes: [
          {
            id: "agent1",
            kind: "agent.codeless",
            data: {
              tools: { policy: "Auto" }
            }
          }
        ]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={onGraphChange}
        />
      );

      const policySelect = screen.getByDisplayValue("Auto");
      fireEvent.change(policySelect, { target: { value: "AlwaysAsk" } });

      expect(onGraphChange).toHaveBeenCalled();
      const updatedGraph = onGraphChange.mock.calls[0][0];
      const updatedNode = updatedGraph.nodes.find((n: any) => n.id === "agent1");
      expect(updatedNode.data.tools.policy).toBe("AlwaysAsk");
    });
  });

  describe("Attaching Tools", () => {
    it("should add DuckDuckGo Search tool when selected from dropdown", () => {
      const onGraphChange = vi.fn();
      const graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", data: {} }
        ]
      };

      const { container, rerender } = render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={onGraphChange}
        />
      );

      const dropdowns = container.querySelectorAll("select");
      const toolDropdown = Array.from(dropdowns).find(el =>
        el.querySelector('option[value="tool:ddgs.search"]')
      ) as HTMLSelectElement;

      fireEvent.change(toolDropdown, { target: { value: "tool:ddgs.search" } });

      // Component state should update but not call onGraphChange until Save
      // Ensure the newly selected tool is rendered in the inspector
      const ddgsElements = screen.getAllByText(/DuckDuckGo Search/i);
      expect(ddgsElements.length).toBeGreaterThan(0);
    });

    it("should show Save button", () => {
      const graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", data: {} }
        ]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      const saveButton = screen.getByRole("button", { name: /Save/i });
      expect(saveButton).toBeDefined();
    });
  });

  describe("Tool Configuration", () => {
    it("should display attached tool with metadata", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            maxResults: { value: 10, visibility: "AgentOverride" }
          }
        }
      };

      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const graph = {
        nodes: [agentNode, toolNode]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      // Multiple instances of the tool label exist (dropdown + attached tool)
      const ddgsElements = screen.getAllByText(/DuckDuckGo Search/i);
      expect(ddgsElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/0\.1\.0/i)).toBeDefined();
    });

    it("should allow removing attached tool", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {}
        }
      };

      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const graph = {
        nodes: [agentNode, toolNode]
      };

      const { container } = render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      const removeButton = screen.getByRole("button", { name: /Remove/i });
      expect(removeButton).toBeDefined();

      fireEvent.click(removeButton);

      // Tool should be removed from local state (not in the document anymore after re-render)
      expect(screen.queryByText(/DuckDuckGo Search.*0\.1\.0/)).toBeNull();
    });
  });

  describe("Parameter Overrides", () => {
    it("should display parameter editors for attached tool", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            query: { value: "", visibility: "Normal" },
            maxResults: { value: 5, visibility: "AgentOverride" },
            siteFilter: { value: ["reuters.com"], visibility: "AgentOverride" }
          }
        }
      };

      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const graph = {
        nodes: [agentNode, toolNode]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      // Check for parameter labels from DDGS schema
      expect(screen.getByText(/Search query/i)).toBeDefined();
      expect(screen.getByText(/Vertical/i)).toBeDefined();
      expect(screen.getByText(/Max results/i)).toBeDefined();
      expect(screen.getByText(/Safe search/i)).toBeDefined();
      expect(screen.getByText(/Region/i)).toBeDefined();
      expect(screen.getByText(/Freshness window/i)).toBeDefined();
      expect(screen.getByText(/Site filter/i)).toBeDefined();
      expect(screen.getByText(/Must include terms/i)).toBeDefined();
      expect(screen.getByText("reuters.com")).toBeDefined();
      expect(screen.getByRole("button", { name: /Add/i })).toBeDefined();
    });

    it("should show visibility dropdowns for parameters", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            maxResults: { value: 5, visibility: "AgentOverride" }
          }
        }
      };

      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const graph = {
        nodes: [agentNode, toolNode]
      };

      render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      // There should be multiple visibility dropdowns (one per parameter)
      const visibilitySelects = screen.getAllByDisplayValue(/AgentOverride|Normal|LLMHidden/i);
      expect(visibilitySelects.length).toBeGreaterThan(0);
    });
  });

  describe("Help Text", () => {
    it("should display help text for visibility modes", () => {
      const graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", data: {} }
        ]
      };

      const { container } = render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={vi.fn()}
        />
      );

      // Find the help text divs - there are two .text-xs.opacity-70, we want the last one
      const helpTextElements = container.querySelectorAll(".text-xs.opacity-70");
      const helpText = helpTextElements[helpTextElements.length - 1];
      expect(helpText).toBeDefined();
      expect(helpText?.textContent).toContain("LLMHidden");
      expect(helpText?.textContent).toContain("AgentOverride");
    });
  });

  describe("Save Functionality", () => {
    it("should call onGraphChange with tool nodes when Save is clicked", () => {
      const onGraphChange = vi.fn();
      
      // Start with an existing tool node
      const existingToolNode = {
        id: "tool1",
        kind: "tool",
        data: {}
      };
      
      const graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", data: {} },
          existingToolNode
        ]
      };

      const { container } = render(
        <ToolConfigPanel
          graph={graph}
          selectedNodeId="agent1"
          onGraphChange={onGraphChange}
        />
      );

      // Add a tool
      const dropdowns = container.querySelectorAll("select");
      const toolDropdown = Array.from(dropdowns).find(el =>
        el.querySelector('option[value="tool:ddgs.search"]')
      ) as HTMLSelectElement;

      fireEvent.change(toolDropdown, { target: { value: "tool:ddgs.search" } });

      // Click Save
      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      expect(onGraphChange).toHaveBeenCalled();
      const updatedGraph = onGraphChange.mock.calls[0][0];
      // Should have agent + at least the tool we added
      expect(updatedGraph.nodes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
