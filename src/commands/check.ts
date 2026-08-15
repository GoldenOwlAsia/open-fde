import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import type { Inventory, Severity } from "../core/types.js";
import { loadEngagement } from "../core/engagement.js";
import { runDefaultChecks } from "../checks/defaultChecks.js";

const SCORE_LABELS: Record<string, string> = {
  security: "Security",
  data: "Data",
  reliability: "Reliability",
  evaluation: "Evaluation",
  observability: "Observability",
  human_control: "Human Control"
};

export async function checkCommand(root: string): Promise<void> {
  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  if (!(await exists(invPath))) throw new Error("Run `fde scan` before `fde check`.");

  const inventory = await readJson<Inventory>(invPath);
  const engagement = await loadEngagement(root);
  const result = runDefaultChecks(inventory, engagement);
  await writeJson(path.join(ws, "check-result.json"), result);

  console.log("OpenFDE Deployment Readiness\n");
  for (const [key, value] of Object.entries(result.scores)) {
    console.log(`${(SCORE_LABELS[key] ?? key).padEnd(15)}${value}`);
  }
  console.log(`\n${"Overall".padEnd(15)}${result.overallScore} / 100`);

  for (const severity of ["critical", "warning", "info"] as Severity[]) {
    const findings = result.findings.filter((f) => f.severity === severity);
    if (!findings.length) continue;
    console.log(`\n${severity.toUpperCase()}`);
    for (const finding of findings) {
      console.log(`- ${finding.title}`);
      for (const evidence of finding.evidence ?? []) console.log(`    evidence: ${evidence}`);
    }
  }
  if (!result.findings.length) console.log("\nNo findings. All default checks passed.");
}
