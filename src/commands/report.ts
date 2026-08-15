import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson } from "../core/workspace.js";
import type { CheckResult, Inventory } from "../core/types.js";
import { loadEngagement } from "../core/engagement.js";
import { renderMarkdownReport } from "../report/renderText.js";

export async function reportCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  const checkPath = path.join(ws, "check-result.json");
  if (!(await exists(invPath)) || !(await exists(checkPath))) throw new Error("Run `fde scan` and `fde check` before `fde report`.");

  const inventory = await readJson<Inventory>(invPath);
  const checks = await readJson<CheckResult>(checkPath);
  const engagement = await loadEngagement(root);
  const output = path.join(ws, "report.md");
  await writeFile(output, renderMarkdownReport(inventory, checks, engagement), "utf8");
  console.log(`Generated ${output}`);
}
