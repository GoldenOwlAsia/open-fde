import path from "node:path";
import { ensureWorkspace, writeJson } from "../core/workspace.js";
import { scanRepository } from "../scanners/repo.js";

export async function scanCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const inventory = await scanRepository(root);
  await writeJson(path.join(ws, "environment", "inventory.json"), inventory);

  console.log(`Detected ${inventory.components.length} components\n`);
  for (const c of inventory.components) console.log(`✓ ${c.name.padEnd(18)} ${c.category}`);
}
