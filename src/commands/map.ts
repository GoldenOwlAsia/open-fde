import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import type { Inventory } from "../core/types.js";
import { loadEngagement } from "../core/engagement.js";
import { buildGraph, renderMermaid } from "../core/graph.js";

export async function mapCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  if (!(await exists(invPath))) throw new Error("Run `fde scan` before `fde map`.");
  const inventory = await readJson<Inventory>(invPath);
  const engagement = await loadEngagement(root);

  const graph = buildGraph(inventory, engagement, root);
  await writeJson(path.join(ws, "environment", "integration-graph.json"), graph);
  await writeFile(path.join(ws, "environment", "integration-graph.mmd"), renderMermaid(graph), "utf8");

  console.log(`Generated integration map with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
  console.log(`  ${path.join(ws, "environment", "integration-graph.json")}`);
  console.log(`  ${path.join(ws, "environment", "integration-graph.mmd")}`);
}
