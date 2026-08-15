import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import type { IntegrationGraph, Inventory } from "../core/types.js";

export async function mapCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  if (!(await exists(invPath))) throw new Error("Run `fde scan` before `fde map`.");
  const inventory = await readJson<Inventory>(invPath);

  const graph: IntegrationGraph = {
    generatedAt: new Date().toISOString(),
    nodes: inventory.components.map((c) => ({ id: c.id, label: c.name, category: c.category })),
    edges: []
  };

  const fdePath = path.join(root, "fde.yaml");
  if (await exists(fdePath)) {
    const text = await readFile(fdePath, "utf8");
    if (/openai|anthropic|bedrock|vertex/i.test(text) && /postgres/i.test(text)) {
      graph.edges.push({ from: "ai-workflow", to: "postgres", relationship: "queries", access: "unknown" });
    }
  }

  const graphPath = path.join(ws, "environment", "integration-graph.json");
  await writeJson(graphPath, graph);

  const lines = ["flowchart LR", ...graph.nodes.map((n) => `  ${n.id.replace(/[^a-zA-Z0-9_]/g, "_")}[\"${n.label}\"]`)];
  for (const e of graph.edges) lines.push(`  ${e.from.replace(/[^a-zA-Z0-9_]/g, "_")} -->|${e.relationship}| ${e.to.replace(/[^a-zA-Z0-9_]/g, "_")}`);
  await writeFile(path.join(ws, "environment", "integration-graph.mmd"), `${lines.join("\n")}\n`, "utf8");

  console.log(`Generated integration map with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
}
