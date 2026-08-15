import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import type { CheckResult, Finding, Inventory, Severity } from "../core/types.js";
import { loadEngagement } from "../core/engagement.js";
import { builtinChecks, runDefaultChecks } from "../checks/defaultChecks.js";
import { annotateFindingsWithLearnings, loadLearnings } from "../core/learnings.js";
import { toSarif } from "../report/sarif.js";
import { VERSION } from "../version.js";

const SCORE_LABELS: Record<string, string> = {
  security: "Security",
  data: "Data",
  reliability: "Reliability",
  evaluation: "Evaluation",
  observability: "Observability",
  human_control: "Human Control"
};

export type CheckFormat = "text" | "json" | "sarif";
export type FailOn = "critical" | "warning" | "never";

export interface CheckCommandOptions {
  only?: string;
  skip?: string;
  format?: string;
  failOn?: string;
}

const parseIds = (value?: string) =>
  value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function parseChoice<T extends string>(value: string | undefined, name: string, choices: T[], fallback: T): T {
  if (value === undefined) return fallback;
  if ((choices as string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${name} "${value}" (use ${choices.join(", ")}).`);
}

/** True when the findings should fail the run under the given --fail-on policy. */
export function shouldFail(findings: Finding[], failOn: FailOn): boolean {
  if (failOn === "never") return false;
  const failing: Severity[] = failOn === "critical" ? ["critical"] : ["critical", "warning"];
  return findings.some((f) => failing.includes(f.severity));
}

export async function checkCommand(root: string, options: CheckCommandOptions = {}): Promise<void> {
  const format = parseChoice<CheckFormat>(options.format, "--format", ["text", "json", "sarif"], "text");
  const failOn = parseChoice<FailOn>(options.failOn, "--fail-on", ["critical", "warning", "never"], "critical");

  const ws = await ensureWorkspace(root);
  const invPath = path.join(ws, "environment", "inventory.json");
  if (!(await exists(invPath))) throw new Error("Run `fde scan` before `fde check`.");

  const inventory = await readJson<Inventory>(invPath);
  const engagement = await loadEngagement(root);
  const raw = await runDefaultChecks(inventory, engagement, {
    only: parseIds(options.only),
    skip: parseIds(options.skip)
  });
  const result = annotateFindingsWithLearnings(raw, await loadLearnings(root));
  await writeJson(path.join(ws, "check-result.json"), result);

  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else if (format === "sarif") {
    console.log(JSON.stringify(toSarif(result, builtinChecks, VERSION), null, 2));
  } else {
    renderText(result);
  }

  if (shouldFail(result.findings, failOn)) process.exitCode = 1;
}

function renderText(result: CheckResult): void {
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
