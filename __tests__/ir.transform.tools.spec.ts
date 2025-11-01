import { describe, it, expect } from "vitest";
import { readAgentToolsFromIR, writeAgentToolsToIR } from "../src/lib/orch/ir/transform";
import type { AgentToolBinding } from "../src/lib/tools/shapes";

describe("IR Transform Tools", () => {
  describe("readAgentToolsFromIR", () => {
    it("should return empty array when no tools attached", () => {
      const node = {
        id: "agent1",
        kind: "agent.codeless",
        data: {}
      };
      const bindings = readAgentToolsFromIR(node, []);
      expect(bindings).toEqual([]);
    });

    it("should return empty array when attached is empty", () => {
      const node = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: []
          }
        }
      };
      const bindings = readAgentToolsFromIR(node, []);
      expect(bindings).toEqual([]);
    });

    it("should read tool bindings from IR", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            maxResults: { value: 10, visibility: "AgentOverride" },
            siteFilter: { value: ["example.com"], visibility: "AgentOverride" }
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

      const bindings = readAgentToolsFromIR(agentNode, [agentNode, toolNode]);
      expect(bindings).toHaveLength(1);
      expect(bindings[0].toolNodeId).toBe("tool1");
      expect(bindings[0].toolId).toBe("tool:ddgs.search");
      expect(bindings[0].overrides.maxResults).toEqual({ value: 10, visibility: "AgentOverride" });
      expect(bindings[0].overrides.siteFilter).toEqual({ value: ["example.com"], visibility: "AgentOverride" });
    });

    it("should use default values from metadata when not overridden", () => {
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

      const bindings = readAgentToolsFromIR(agentNode, [agentNode, toolNode]);
      expect(bindings).toHaveLength(1);
      expect(bindings[0].overrides.maxResults?.value).toBe(5); // default from ddgs.meta
      expect(bindings[0].overrides.safesearch?.value).toBe("moderate");
      expect(bindings[0].overrides.region?.value).toBe("us-en");
      expect(bindings[0].overrides.timeLimit?.value).toBe("");
      expect(bindings[0].overrides.siteFilter?.value).toEqual([]);
      expect(bindings[0].overrides.mustInclude?.value).toEqual([]);
    });

    it("should handle missing tool node", () => {
      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool-missing"]
          }
        }
      };

      const bindings = readAgentToolsFromIR(agentNode, [agentNode]);
      expect(bindings).toEqual([]);
    });
  });

  describe("writeAgentToolsToIR", () => {
    it("should write tool bindings to IR", () => {
      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {}
      };

      const existingToolNode = {
        id: "tool1",
        kind: "tool",
        data: {}
      };

      const bindings: AgentToolBinding[] = [
        {
          toolNodeId: "tool1",
          toolId: "tool:ddgs.search",
          overrides: {
            query: { value: "", visibility: "Normal" },
            maxResults: { value: 10, visibility: "AgentOverride" },
            safesearch: { value: "strict", visibility: "AgentOverride" }
          }
        }
      ];

      const { node, nodes } = writeAgentToolsToIR(agentNode, [agentNode, existingToolNode], bindings);

      expect(node.data.tools.attached).toEqual(["tool1"]);
      expect(nodes).toHaveLength(2); // agent + tool node
      
      const toolNode = nodes.find((n) => n.id === "tool1");
      expect(toolNode).toBeDefined();
      expect(toolNode?.data?.toolId).toBe("tool:ddgs.search");
      expect(toolNode?.data?.parameterOverrides).toEqual({
        query: { value: "", visibility: "Normal" },
        maxResults: { value: 10, visibility: "AgentOverride" },
        safesearch: { value: "strict", visibility: "AgentOverride" }
      });
    });

    it("should update existing tool nodes", () => {
      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const existingToolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            maxResults: { value: 5, visibility: "Normal" }
          }
        }
      };

      const bindings: AgentToolBinding[] = [
        {
          toolNodeId: "tool1",
          toolId: "tool:ddgs.search",
          overrides: {
            maxResults: { value: 20, visibility: "AgentOverride" },
            safesearch: { value: "off", visibility: "AgentOverride" }
          }
        }
      ];

      const { node, nodes } = writeAgentToolsToIR(agentNode, [agentNode, existingToolNode], bindings);

      const toolNode = nodes.find((n) => n.id === "tool1");
      expect(toolNode?.data?.parameterOverrides.maxResults).toEqual({ value: 20, visibility: "AgentOverride" });
      expect(toolNode?.data?.parameterOverrides.safesearch).toEqual({ value: "off", visibility: "AgentOverride" });
    });

    it("should preserve unrelated nodes", () => {
      const agentNode = { id: "agent1", kind: "agent.codeless", data: {} };
      const otherNode = { id: "other1", kind: "agent.router", data: { foo: "bar" } };

      const bindings: AgentToolBinding[] = [
        {
          toolNodeId: "tool1",
          toolId: "tool:ddgs.search",
          overrides: {
            maxResults: { value: 10, visibility: "Normal" }
          }
        }
      ];

      const { nodes } = writeAgentToolsToIR(agentNode, [agentNode, otherNode], bindings);

      const preserved = nodes.find((n) => n.id === "other1");
      expect(preserved).toEqual(otherNode);
    });

    it("should handle empty bindings", () => {
      const agentNode = {
        id: "agent1",
        kind: "agent.codeless",
        data: {
          tools: {
            attached: ["tool1"]
          }
        }
      };

      const { node, nodes } = writeAgentToolsToIR(agentNode, [agentNode], []);

      expect(node.data.tools.attached).toEqual([]);
      expect(nodes).toHaveLength(1); // only agent node
    });
  });

  describe("Round-trip", () => {
    it("should preserve data through read-write cycle", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            query: { value: "test query", visibility: "Normal" },
            maxResults: { value: 15, visibility: "AgentOverride" },
            siteFilter: { value: ["example.com"], visibility: "AgentOverride" },
            mustInclude: { value: ["breaking"], visibility: "AgentOverride" }
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

      const allNodes = [agentNode, toolNode];

      // Read
      const bindings = readAgentToolsFromIR(agentNode, allNodes);

      // Write
      const { node: updatedAgent, nodes: updatedNodes } = writeAgentToolsToIR(agentNode, allNodes, bindings);

      // Verify - the write will include all fields from the binding (which includes defaults)
      const updatedToolNode = updatedNodes.find((n) => n.id === "tool1");
      expect(updatedAgent.data.tools.attached).toEqual(["tool1"]);

      // Check that the explicitly set values are preserved
      expect(updatedToolNode?.data?.parameterOverrides.query).toEqual({ value: "test query", visibility: "Normal" });
      expect(updatedToolNode?.data?.parameterOverrides.maxResults).toEqual({ value: 15, visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.siteFilter).toEqual({ value: ["example.com"], visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.mustInclude).toEqual({ value: ["breaking"], visibility: "AgentOverride" });

      // The read operation will have filled in defaults for other fields
      // so the write will include them too (this is expected behavior)
      expect(updatedToolNode?.data?.parameterOverrides.safesearch).toBeDefined();
      expect(updatedToolNode?.data?.parameterOverrides.timeLimit).toBeDefined();
      expect(updatedToolNode?.data?.parameterOverrides.region).toBeDefined();
    });

    it("should handle modifications during round-trip", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:ddgs.search",
          parameterOverrides: {
            maxResults: { value: 5, visibility: "Normal" }
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

      const allNodes = [agentNode, toolNode];

      // Read
      const bindings = readAgentToolsFromIR(agentNode, allNodes);

      // Modify
      bindings[0].overrides.maxResults = { value: 20, visibility: "AgentOverride" };
      bindings[0].overrides.safesearch = { value: "strict", visibility: "AgentOverride" };

      // Write
      const { nodes: updatedNodes } = writeAgentToolsToIR(agentNode, allNodes, bindings);

      // Verify changes
      const updatedToolNode = updatedNodes.find((n) => n.id === "tool1");
      expect(updatedToolNode?.data?.parameterOverrides.maxResults).toEqual({ value: 20, visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.safesearch).toEqual({ value: "strict", visibility: "AgentOverride" });
    });
  });
});
