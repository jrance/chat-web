import type { Graph, McpServerNode } from "./shapes";

export function listMcpServers(graph: Graph): McpServerNode[] {
  return (graph.nodes || []).filter(n => n?.kind === "mcpServer") as McpServerNode[];
}

export function upsertMcpServer(graph: Graph, node: Partial<McpServerNode>): Graph {
  const id = node.id ?? (globalThis.crypto?.randomUUID?.() || String(Math.random()));
  const idx = graph.nodes.findIndex(n => n.id === id);
  const full: McpServerNode = {
    id,
    kind: "mcpServer",
    label: node.label || "MCP Server",
    data: {
      url: node.data?.url || "",
      protocol: node.data?.protocol || "mcp/1.0",
      auth: node.data?.auth || { type: "client_credentials", secretRef: null },
      capabilities: node.data?.capabilities || { tools: true, resources: false, prompts: false, sampling: false },
      namespaceFilter: node.data?.namespaceFilter || [],
      metadata: node.data?.metadata || {}
    }
  };
  const nodes = [...graph.nodes];
  if (idx >= 0) nodes[idx] = full; else nodes.push(full);
  return { ...graph, nodes };
}

export function removeMcpServer(graph: Graph, serverId: string): Graph {
  const nodes = (graph.nodes || []).filter(n => n.id !== serverId);
  const edges = (graph.edges || []).filter(e => !(e.from === serverId || e.to === serverId));
  return { ...graph, nodes, edges };
}

// Agent ↔ MCP edges
export function getAgentAttachedServers(graph: Graph, agentId: string): string[] {
  return (graph.edges || []).filter(e => e.from === agentId)
    .map(e => e.to)
    .filter(to => (graph.nodes || []).some(n => n.id === to && n.kind === "mcpServer"));
}

export function setAgentAttachedServers(graph: Graph, agentId: string, serverIds: string[]): Graph {
  const keep = (graph.edges || []).filter(e => !(e.from === agentId && (graph.nodes || []).some(n => n.id === e.to && n.kind === "mcpServer")));
  const newEdges = serverIds.map((sid) => ({
    id: `${agentId}→${sid}`,
    from: agentId,
    to: sid,
    label: ""
  }));
  return { ...graph, edges: [...keep, ...newEdges] };
}
