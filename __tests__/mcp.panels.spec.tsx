import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentMcpAttach from "../src/features/inspector/AgentMcpAttach";
import type { IRGraph } from "../src/modules/agent-builder/model/ir";

describe("MCP Panels", () => {
  describe("AgentMcpAttach", () => {
    it("should show placeholder when no MCP servers exist", () => {
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [{ id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any }],
        edges: [],
      };

      render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      expect(screen.getByText(/No MCP servers in this graph yet/i)).toBeDefined();
    });

    it("should render list of available MCP servers", () => {
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "OneDrive MCP",
            data: {
              url: "https://onedrive.example.com/mcp",
              protocol: "mcp/1.0",
              auth: { type: "client_credentials" },
              capabilities: { tools: true },
            },
          },
          {
            id: "mcp2",
            kind: "mcpServer",
            label: "SharePoint MCP",
            data: {
              url: "https://sharepoint.example.com/mcp",
              protocol: "mcp/1.0",
              auth: { type: "OBO" },
              capabilities: { resources: true },
            },
          },
        ],
        edges: [],
      };

      render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      expect(screen.getByText("OneDrive MCP")).toBeDefined();
      expect(screen.getByText("SharePoint MCP")).toBeDefined();
      expect(screen.getByText(/mcp\/1\.0.*https:\/\/onedrive/i)).toBeDefined();
    });

    it("should show checkboxes for each server", () => {
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
        ],
        edges: [],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(1);
    });

    it("should check boxes for attached servers", () => {
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
          {
            id: "mcp2",
            kind: "mcpServer",
            label: "Server 2",
            data: { url: "https://test2", protocol: "mcp/1.0" },
          },
        ],
        edges: [{ id: "e1", from: "agent1", to: "mcp1", label: "" }],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true); // mcp1 is attached
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false); // mcp2 is not attached
    });

    it("should call onGraphChange when toggling server attachment", () => {
      const onGraphChange = vi.fn();
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
        ],
        edges: [],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={onGraphChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(onGraphChange).toHaveBeenCalledTimes(1);
      const updatedGraph = onGraphChange.mock.calls[0][0];
      expect(updatedGraph.edges).toHaveLength(1);
      expect(updatedGraph.edges[0].from).toBe("agent1");
      expect(updatedGraph.edges[0].to).toBe("mcp1");
    });

    it("should remove edge when unchecking attached server", () => {
      const onGraphChange = vi.fn();
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
        ],
        edges: [{ id: "e1", from: "agent1", to: "mcp1", label: "" }],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={onGraphChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);

      expect(onGraphChange).toHaveBeenCalledTimes(1);
      const updatedGraph = onGraphChange.mock.calls[0][0];
      expect(updatedGraph.edges).toHaveLength(0);
    });

    it("should handle multiple server attachments", () => {
      const onGraphChange = vi.fn();
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
          {
            id: "mcp2",
            kind: "mcpServer",
            label: "Server 2",
            data: { url: "https://test2", protocol: "mcp/1.0" },
          },
        ],
        edges: [{ id: "e1", from: "agent1", to: "mcp1", label: "" }],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={onGraphChange} />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);

      // Attach second server
      fireEvent.click(checkboxes[1]);

      const updatedGraph = onGraphChange.mock.calls[0][0];
      expect(updatedGraph.edges).toHaveLength(2);
      expect(updatedGraph.edges.some((e: any) => e.to === "mcp1")).toBe(true);
      expect(updatedGraph.edges.some((e: any) => e.to === "mcp2")).toBe(true);
    });

    it("should preserve edges from other agents", () => {
      const onGraphChange = vi.fn();
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent 1", data: {} as any },
          { id: "agent2", kind: "agent.codeless", label: "Agent 2", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent2", to: "mcp1", label: "" },
        ],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={onGraphChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox); // Detach from agent1

      const updatedGraph = onGraphChange.mock.calls[0][0];
      expect(updatedGraph.edges).toHaveLength(1);
      expect(updatedGraph.edges[0].from).toBe("agent2"); // agent2's edge preserved
    });

    it("should show attachment count when servers are attached", () => {
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
          {
            id: "mcp2",
            kind: "mcpServer",
            label: "Server 2",
            data: { url: "https://test2", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent1", to: "mcp2", label: "" },
        ],
      };

      render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      expect(screen.getByText(/2 servers attached/i)).toBeDefined();
    });

    it("should not filter out tool edges when managing MCP servers", () => {
      const onGraphChange = vi.fn();
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          { id: "tool1", kind: "tool", label: "Tool", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server 1",
            data: { url: "https://test1", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "tool1", label: "" },
        ],
      };

      const { container } = render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={onGraphChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox); // Attach MCP server

      const updatedGraph = onGraphChange.mock.calls[0][0];
      expect(updatedGraph.edges).toHaveLength(2); // Both tool and MCP edges
      expect(updatedGraph.edges.some((e: any) => e.to === "tool1")).toBe(true);
      expect(updatedGraph.edges.some((e: any) => e.to === "mcp1")).toBe(true);
    });
  });

  describe("MCPServerInspector integration", () => {
    it("should work with the expected data structure", () => {
      // This test verifies that the component can handle the IR structure
      const graph: IRGraph = {
        meta: { id: "test", name: "Test", version: "1.0.0" },
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} as any },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "OneDrive MCP",
            description: "Access OneDrive files",
            data: {
              url: "https://onedrive.example.com/mcp",
              protocol: "mcp/1.0",
              auth: {
                type: "client_credentials",
                secretRef: "secrets/onedrive-cc",
                scopes: ["Files.Read", "Files.Write"],
              },
              capabilities: {
                tools: true,
                resources: true,
                prompts: false,
                sampling: false,
              },
              namespaceFilter: ["Documents", "Shared"],
              metadata: {
                owner: "IT",
                region: "US",
              },
            },
          },
        ],
        edges: [],
      };

      render(
        <AgentMcpAttach graph={graph} agentId="agent1" onGraphChange={vi.fn()} />
      );

      expect(screen.getByText("OneDrive MCP")).toBeDefined();
      expect(screen.getByText(/mcp\/1\.0.*https:\/\/onedrive/i)).toBeDefined();
    });
  });
});
