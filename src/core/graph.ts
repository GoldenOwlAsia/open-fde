import path from "node:path";
import type { ComponentCategory, GraphEdge, IntegrationGraph, Inventory } from "./types.js";
import type { Engagement } from "./engagement.js";

const INTEGRATION_CATEGORIES = new Set<ComponentCategory>(["data", "cloud", "ai", "observability", "auth"]);

const SYSTEM_TYPE_CATEGORIES: Record<string, ComponentCategory> = {
  postgres: "data",
  mysql: "data",
  redis: "data",
  s3: "data",
  aws: "cloud",
  azure: "cloud",
  gcp: "cloud",
  openai: "ai",
  anthropic: "ai",
  bedrock: "ai",
  vertex: "ai",
  sentry: "observability",
  opentelemetry: "observability",
  datadog: "observability",
  okta: "auth",
  auth0: "auth"
};

const normalizeAccess = (access?: string): GraphEdge["access"] =>
  access === "read_only" || access === "read_write" ? access : "unknown";

const mermaidId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

/** Pure graph construction shared by `fde map`, `fde export`, and the MCP server. */
export function buildGraph(inventory: Inventory, engagement: Engagement | null, root: string): IntegrationGraph {
  const appId = "app";
  const appLabel = engagement?.metadata?.name ?? path.basename(root);
  const nodes: IntegrationGraph["nodes"] = [
    { id: appId, label: appLabel, category: "other" },
    ...inventory.components.map((c) => ({ id: c.id, label: c.name, category: c.category }))
  ];

  // Declared access from fde.yaml, keyed by system type, applied to matching detected components.
  const declaredAccess = new Map<string, GraphEdge["access"]>();
  const systems = engagement?.spec?.systems ?? [];
  for (const system of systems) {
    if (system.type) declaredAccess.set(system.type.toLowerCase(), normalizeAccess(system.access));
  }

  const edges: GraphEdge[] = inventory.components
    .filter((c) => INTEGRATION_CATEGORIES.has(c.category))
    .map((c) => ({
      from: appId,
      to: c.id,
      relationship: "uses",
      access: declaredAccess.get(c.id) ?? "unknown"
    }));

  // Declared systems with no detected counterpart still belong on the map.
  // Track which graph node represents each declared system id so agent tools
  // can point at it.
  const systemNodeIds = new Map<string, string>();
  for (const system of systems) {
    const type = system.type?.toLowerCase();
    if (!type) continue;
    if (nodes.some((n) => n.id === type)) {
      if (system.id) systemNodeIds.set(system.id, type);
      continue;
    }
    const id = system.id ?? type;
    if (system.id) systemNodeIds.set(system.id, id);
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({ id, label: `${system.id ?? type} (declared)`, category: SYSTEM_TYPE_CATEGORIES[type] ?? "other" });
    edges.push({ from: appId, to: id, relationship: "declared", access: normalizeAccess(system.access) });
  }

  // Declared agents: agent → tool → system edges with access and PII flags.
  for (const agent of engagement?.spec?.agents ?? []) {
    if (!agent.id) continue;
    nodes.push({ id: agent.id, label: agent.id, category: "agent" });
    edges.push({ from: appId, to: agent.id, relationship: "runs" });
    for (const tool of agent.tools ?? []) {
      if (!tool.id) continue;
      const toolNodeId = `${agent.id}.${tool.id}`;
      nodes.push({ id: toolNodeId, label: tool.id, category: "tool" });
      edges.push({ from: agent.id, to: toolNodeId, relationship: "holds" });
      const target = tool.system ? systemNodeIds.get(tool.system) : undefined;
      if (!target) continue; // undeclared refs are surfaced by `fde check`
      const edge: GraphEdge = {
        from: toolNodeId,
        to: target,
        relationship: tool.sideEffects ? "uses (side-effecting)" : "uses",
        access: normalizeAccess(tool.access)
      };
      if (tool.containsPii !== undefined) edge.containsPii = tool.containsPii;
      edges.push(edge);
    }
  }

  return { generatedAt: new Date().toISOString(), nodes, edges };
}

export function renderMermaid(graph: IntegrationGraph): string {
  const lines = ["flowchart LR", ...graph.nodes.map((n) => `  ${mermaidId(n.id)}["${n.label}"]`)];
  for (const e of graph.edges) {
    const label = e.access && e.access !== "unknown" ? `${e.relationship} (${e.access})` : e.relationship;
    lines.push(`  ${mermaidId(e.from)} -->|${label}| ${mermaidId(e.to)}`);
  }
  return `${lines.join("\n")}\n`;
}
