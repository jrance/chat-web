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
          toolId: "tool:web-search",
          parameterOverrides: {
            limit: { value: 10, visibility: "AgentOverride" },
            apiKeyRef: { value: "secrets/search-api", visibility: "LLMHidden" }
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
      expect(bindings[0].toolId).toBe("tool:web-search");
      expect(bindings[0].overrides.limit).toEqual({ value: 10, visibility: "AgentOverride" });
      expect(bindings[0].overrides.apiKeyRef).toEqual({ value: "secrets/search-api", visibility: "LLMHidden" });
    });

    it("should use default values from metadata when not overridden", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:web-search",
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
      expect(bindings[0].overrides.limit?.value).toBe(5); // default from webSearch.meta
      expect(bindings[0].overrides.safeSearch?.value).toBe(true); // default from webSearch.meta
      expect(bindings[0].overrides.recency?.value).toBe("30d"); // default from webSearch.meta
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
          toolId: "tool:web-search",
          overrides: {
            query: { value: "", visibility: "Normal" },
            limit: { value: 10, visibility: "AgentOverride" },
            apiKeyRef: { value: "secrets/search-api", visibility: "LLMHidden" }
          }
        }
      ];

      const { node, nodes } = writeAgentToolsToIR(agentNode, [agentNode, existingToolNode], bindings);

      expect(node.data.tools.attached).toEqual(["tool1"]);
      expect(nodes).toHaveLength(2); // agent + tool node
      
      const toolNode = nodes.find((n) => n.id === "tool1");
      expect(toolNode).toBeDefined();
      expect(toolNode?.data?.toolId).toBe("tool:web-search");
      expect(toolNode?.data?.parameterOverrides).toEqual({
        query: { value: "", visibility: "Normal" },
        limit: { value: 10, visibility: "AgentOverride" },
        apiKeyRef: { value: "secrets/search-api", visibility: "LLMHidden" }
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
          toolId: "tool:web-search",
          parameterOverrides: {
            limit: { value: 5, visibility: "Normal" }
          }
        }
      };

      const bindings: AgentToolBinding[] = [
        {
          toolNodeId: "tool1",
          toolId: "tool:web-search",
          overrides: {
            limit: { value: 20, visibility: "AgentOverride" },
            safeSearch: { value: false, visibility: "AgentOverride" }
          }
        }
      ];

      const { node, nodes } = writeAgentToolsToIR(agentNode, [agentNode, existingToolNode], bindings);

      const toolNode = nodes.find((n) => n.id === "tool1");
      expect(toolNode?.data?.parameterOverrides.limit).toEqual({ value: 20, visibility: "AgentOverride" });
      expect(toolNode?.data?.parameterOverrides.safeSearch).toEqual({ value: false, visibility: "AgentOverride" });
    });

    it("should preserve unrelated nodes", () => {
      const agentNode = { id: "agent1", kind: "agent.codeless", data: {} };
      const otherNode = { id: "other1", kind: "agent.router", data: { foo: "bar" } };

      const bindings: AgentToolBinding[] = [
        {
          toolNodeId: "tool1",
          toolId: "tool:web-search",
          overrides: {
            limit: { value: 10, visibility: "Normal" }
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
          toolId: "tool:web-search",
          parameterOverrides: {
            query: { value: "test query", visibility: "Normal" },
            limit: { value: 15, visibility: "AgentOverride" },
            site: { value: "example.com", visibility: "AgentOverride" },
            apiKeyRef: { value: "secrets/key", visibility: "LLMHidden" }
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
      expect(updatedToolNode?.data?.parameterOverrides.limit).toEqual({ value: 15, visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.site).toEqual({ value: "example.com", visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.apiKeyRef).toEqual({ value: "secrets/key", visibility: "LLMHidden" });
      
      // The read operation will have filled in defaults for other fields
      // so the write will include them too (this is expected behavior)
      expect(updatedToolNode?.data?.parameterOverrides.recency).toBeDefined();
      expect(updatedToolNode?.data?.parameterOverrides.safeSearch).toBeDefined();
    });

    it("should handle modifications during round-trip", () => {
      const toolNode = {
        id: "tool1",
        kind: "tool",
        data: {
          toolId: "tool:web-search",
          parameterOverrides: {
            limit: { value: 5, visibility: "Normal" }
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
      bindings[0].overrides.limit = { value: 20, visibility: "AgentOverride" };
      bindings[0].overrides.safeSearch = { value: false, visibility: "AgentOverride" };

      // Write
      const { nodes: updatedNodes } = writeAgentToolsToIR(agentNode, allNodes, bindings);

      // Verify changes
      const updatedToolNode = updatedNodes.find((n) => n.id === "tool1");
      expect(updatedToolNode?.data?.parameterOverrides.limit).toEqual({ value: 20, visibility: "AgentOverride" });
      expect(updatedToolNode?.data?.parameterOverrides.safeSearch).toEqual({ value: false, visibility: "AgentOverride" });
    });
  });
});
