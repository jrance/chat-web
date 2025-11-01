import { describe, it, expect } from "vitest";
import {
  listMcpServers,
  upsertMcpServer,
  removeMcpServer,
  getAgentAttachedServers,
  setAgentAttachedServers,
} from "../src/lib/mcp/ir";
import type { Graph, McpServerNode } from "../src/lib/mcp/shapes";

describe("MCP IR Helpers", () => {
  describe("listMcpServers", () => {
    it("should return empty array when no nodes", () => {
      const graph: Graph = { nodes: [], edges: [] };
      const servers = listMcpServers(graph);
      expect(servers).toEqual([]);
    });

    it("should return empty array when no MCP servers", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          { id: "tool1", kind: "tool", label: "Tool", data: {} },
        ],
        edges: [],
      };
      const servers = listMcpServers(graph);
      expect(servers).toEqual([]);
    });

    it("should return only MCP server nodes", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "OneDrive",
            data: { url: "https://onedrive.mcp", protocol: "mcp/1.0" },
          },
          { id: "tool1", kind: "tool", label: "Tool", data: {} },
          {
            id: "mcp2",
            kind: "mcpServer",
            label: "SharePoint",
            data: { url: "https://sharepoint.mcp", protocol: "mcp/1.0" },
          },
        ],
        edges: [],
      };
      const servers = listMcpServers(graph);
      expect(servers).toHaveLength(2);
      expect(servers[0].id).toBe("mcp1");
      expect(servers[1].id).toBe("mcp2");
    });
  });

  describe("upsertMcpServer", () => {
    it("should add a new MCP server with defaults", () => {
      const graph: Graph = { nodes: [], edges: [] };
      const updated = upsertMcpServer(graph, {
        label: "Test Server",
      });

      expect(updated.nodes).toHaveLength(1);
      const server = updated.nodes[0] as McpServerNode;
      expect(server.kind).toBe("mcpServer");
      expect(server.label).toBe("Test Server");
      expect(server.data.url).toBe("");
      expect(server.data.protocol).toBe("mcp/1.0");
      expect(server.data.auth?.type).toBe("client_credentials");
      expect(server.data.capabilities?.tools).toBe(true);
      expect(server.data.capabilities?.resources).toBe(false);
      expect(server.data.namespaceFilter).toEqual([]);
    });

    it("should add a new MCP server with custom data", () => {
      const graph: Graph = { nodes: [], edges: [] };
      const updated = upsertMcpServer(graph, {
        label: "OneDrive MCP",
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
          metadata: { owner: "IT" },
        },
      });

      expect(updated.nodes).toHaveLength(1);
      const server = updated.nodes[0] as McpServerNode;
      expect(server.label).toBe("OneDrive MCP");
      expect(server.data.url).toBe("https://onedrive.example.com/mcp");
      expect(server.data.auth?.type).toBe("client_credentials");
      expect(server.data.auth?.secretRef).toBe("secrets/onedrive-cc");
      expect(server.data.auth?.scopes).toEqual(["Files.Read", "Files.Write"]);
      expect(server.data.capabilities?.resources).toBe(true);
      expect(server.data.namespaceFilter).toEqual(["Documents", "Shared"]);
      expect(server.data.metadata?.owner).toBe("IT");
    });

    it("should update an existing MCP server", () => {
      const graph: Graph = {
        nodes: [
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Old Label",
            data: {
              url: "https://old.url",
              protocol: "mcp/1.0",
            },
          },
        ],
        edges: [],
      };

      const updated = upsertMcpServer(graph, {
        id: "mcp1",
        label: "New Label",
        data: {
          url: "https://new.url",
          protocol: "mcp/1.0",
          auth: { type: "api_key", secretRef: "secrets/key" },
        },
      });

      expect(updated.nodes).toHaveLength(1);
      const server = updated.nodes[0] as McpServerNode;
      expect(server.id).toBe("mcp1");
      expect(server.label).toBe("New Label");
      expect(server.data.url).toBe("https://new.url");
      expect(server.data.auth?.type).toBe("api_key");
    });

    it("should preserve other nodes when adding MCP server", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
        ],
        edges: [],
      };

      const updated = upsertMcpServer(graph, {
        label: "Server",
      });

      expect(updated.nodes).toHaveLength(2);
      expect(updated.nodes[0].id).toBe("agent1");
    });
  });

  describe("removeMcpServer", () => {
    it("should remove MCP server and related edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "mcp1", to: "tool1", label: "" },
        ],
      };

      const updated = removeMcpServer(graph, "mcp1");

      expect(updated.nodes).toHaveLength(1);
      expect(updated.nodes[0].id).toBe("agent1");
      expect(updated.edges).toHaveLength(0);
    });

    it("should preserve other nodes and edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
          { id: "tool1", kind: "tool", label: "Tool", data: {} },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent1", to: "tool1", label: "" },
        ],
      };

      const updated = removeMcpServer(graph, "mcp1");

      expect(updated.nodes).toHaveLength(2);
      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].id).toBe("e2");
    });

    it("should handle removing non-existent server", () => {
      const graph: Graph = {
        nodes: [{ id: "agent1", kind: "agent.codeless", label: "Agent", data: {} }],
        edges: [],
      };

      const updated = removeMcpServer(graph, "nonexistent");

      expect(updated.nodes).toHaveLength(1);
      expect(updated.edges).toHaveLength(0);
    });
  });

  describe("getAgentAttachedServers", () => {
    it("should return empty array when no edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
        ],
        edges: [],
      };

      const attached = getAgentAttachedServers(graph, "agent1");
      expect(attached).toEqual([]);
    });

    it("should return only MCP server IDs attached to agent", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
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
          { id: "tool1", kind: "tool", label: "Tool", data: {} },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent1", to: "mcp2", label: "" },
          { id: "e3", from: "agent1", to: "tool1", label: "" },
        ],
      };

      const attached = getAgentAttachedServers(graph, "agent1");
      expect(attached).toHaveLength(2);
      expect(attached).toContain("mcp1");
      expect(attached).toContain("mcp2");
      expect(attached).not.toContain("tool1");
    });

    it("should ignore edges from other agents", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent 1", data: {} },
          { id: "agent2", kind: "agent.codeless", label: "Agent 2", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent2", to: "mcp1", label: "" },
        ],
      };

      const attached = getAgentAttachedServers(graph, "agent1");
      expect(attached).toEqual(["mcp1"]);
    });
  });

  describe("setAgentAttachedServers", () => {
    it("should create edges for attached servers", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
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
        edges: [],
      };

      const updated = setAgentAttachedServers(graph, "agent1", ["mcp1", "mcp2"]);

      expect(updated.edges).toHaveLength(2);
      expect(updated.edges.some((e) => e.from === "agent1" && e.to === "mcp1")).toBe(true);
      expect(updated.edges.some((e) => e.from === "agent1" && e.to === "mcp2")).toBe(true);
    });

    it("should replace existing MCP server edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
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

      const updated = setAgentAttachedServers(graph, "agent1", ["mcp2"]);

      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].to).toBe("mcp2");
    });

    it("should preserve non-MCP edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
          { id: "tool1", kind: "tool", label: "Tool", data: {} },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent1", to: "tool1", label: "" },
        ],
      };

      const updated = setAgentAttachedServers(graph, "agent1", []);

      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].id).toBe("e2");
    });

    it("should handle empty server list", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
        ],
        edges: [{ id: "e1", from: "agent1", to: "mcp1", label: "" }],
      };

      const updated = setAgentAttachedServers(graph, "agent1", []);

      expect(updated.edges).toHaveLength(0);
    });

    it("should not affect edges from other agents", () => {
      const graph: Graph = {
        nodes: [
          { id: "agent1", kind: "agent.codeless", label: "Agent 1", data: {} },
          { id: "agent2", kind: "agent.codeless", label: "Agent 2", data: {} },
          {
            id: "mcp1",
            kind: "mcpServer",
            label: "Server",
            data: { url: "https://test", protocol: "mcp/1.0" },
          },
        ],
        edges: [
          { id: "e1", from: "agent1", to: "mcp1", label: "" },
          { id: "e2", from: "agent2", to: "mcp1", label: "" },
        ],
      };

      const updated = setAgentAttachedServers(graph, "agent1", []);

      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].id).toBe("e2");
    });
  });

  describe("Round-trip test", () => {
    it("should maintain consistency through create, attach, and remove operations", () => {
      let graph: Graph = { nodes: [], edges: [] };

      // Add agent
      graph.nodes.push({
        id: "agent1",
        kind: "agent.codeless",
        label: "Agent",
        data: {},
      });

      // Create MCP server
      graph = upsertMcpServer(graph, {
        id: "mcp1",
        label: "OneDrive MCP",
        data: {
          url: "https://onedrive.example.com/mcp",
          protocol: "mcp/1.0",
          auth: {
            type: "client_credentials",
            secretRef: "secrets/onedrive-cc",
            scopes: ["Files.Read"],
          },
          capabilities: { tools: true, resources: true },
          namespaceFilter: ["Documents"],
        },
      });

      expect(listMcpServers(graph)).toHaveLength(1);

      // Attach server to agent
      graph = setAgentAttachedServers(graph, "agent1", ["mcp1"]);

      expect(getAgentAttachedServers(graph, "agent1")).toEqual(["mcp1"]);
      expect(graph.edges).toHaveLength(1);

      // Update server
      graph = upsertMcpServer(graph, {
        id: "mcp1",
        label: "OneDrive MCP Updated",
        data: {
          url: "https://onedrive-new.example.com/mcp",
          protocol: "mcp/1.0",
        },
      });

      const servers = listMcpServers(graph);
      expect(servers[0].label).toBe("OneDrive MCP Updated");
      expect(getAgentAttachedServers(graph, "agent1")).toEqual(["mcp1"]);

      // Remove server (should also remove edge)
      graph = removeMcpServer(graph, "mcp1");

      expect(listMcpServers(graph)).toHaveLength(0);
      expect(getAgentAttachedServers(graph, "agent1")).toEqual([]);
      expect(graph.edges).toHaveLength(0);
    });
  });
});
