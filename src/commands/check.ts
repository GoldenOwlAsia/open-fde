import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import type { Inventory } from "../core/types.js";
import { runDefaultChecks } from "../checks/defaultChecks.js";

export async function checkCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  if (!(await exists(invPath))) throw new Error("Run `fde scan` before `fde check`.");

  const inventory = await readJson<Inventory>(invPath);
  const fdePath = path.join(root, "fde.yaml");
  const engagement = (await exists(fdePath)) ? await readFile(fdePath, "utf8") : "";
  const result = runDefaultChecks(inventory, engagement);
  await writeJson(path.join(ws, "check-result.json"), result);

  console.log("OpenFDE Deployment Readiness\n");
  for (const [name, value] of Object.entries(result.scores)) console.log(`${name.padEnd(15)} ${value}`);
  console.log(`\nOverall         ${result.overallScore} / 100\n`);
  for (const finding of result.findings) console.log(`${finding.severity.toUpperCase().padEnd(8)} ${finding.title}`);
}
