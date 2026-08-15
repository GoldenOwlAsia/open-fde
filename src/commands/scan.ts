import path from "node:path";
import { ensureWorkspace, writeJson } from "../core/workspace.js";
import { scanRepository } from "../scanners/repo.js";
import type { ComponentCategory } from "../core/types.js";

const CATEGORY_LABELS: Array<[ComponentCategory, string]> = [
  ["runtime", "Runtime"],
  ["infrastructure", "Infrastructure"],
  ["data", "Data"],
  ["cloud", "Cloud"],
  ["ai", "AI"],
  ["observability", "Observability"],
  ["auth", "Auth"],
  ["cicd", "CI/CD"],
  ["other", "Other"]
];

export async function scanCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const inventory = await scanRepository(root);
  const outPath = path.join(ws, "environment", "inventory.json");
  await writeJson(outPath, inventory);

  console.log("OpenFDE Scan\n");
  console.log(`Detected ${inventory.components.length} components`);
  for (const [category, label] of CATEGORY_LABELS) {
    const components = inventory.components.filter((c) => c.category === category);
    if (!components.length) continue;
    console.log(`\n${label}`);
    for (const c of components) console.log(`  ✓ ${c.name.padEnd(16)} (${c.evidence[0] ?? ""})`);
  }
  console.log(`\nWrote ${outPath}`);
}
