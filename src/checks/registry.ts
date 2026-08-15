import type { CheckResult, Finding, Inventory, Severity } from "../core/types.js";
import type { Engagement } from "../core/engagement.js";

export interface CheckContext {
  inventory: Inventory;
  engagement: Engagement | null;
  /** Engagement root directory, for checks that verify artifacts on disk. */
  root: string;
}

// The internal check contract. This is the same shape the future plugin
// contract will expose (see docs/PLUGIN_CONTRACT.md) — built-ins are just
// checks that ship with the CLI. No dynamic loading yet.
export interface Check {
  id: string;
  category: Finding["category"];
  description: string;
  /** Cheap predicate deciding whether the check is relevant for this context. */
  appliesTo: (context: CheckContext) => boolean;
  /** Runs the check; returns zero or more findings, each carrying evidence. */
  run: (context: CheckContext) => Finding[] | Promise<Finding[]>;
}

export interface RunOptions {
  /** Run only these check ids. */
  only?: string[];
  /** Run everything except these check ids. */
  skip?: string[];
}

export interface SeverityOverride {
  id?: string;
  severity?: string;
  reason?: string;
}

const SEVERITIES: Severity[] = ["critical", "warning", "info"];

function scoreFromFindings(findings: Finding[], category: Finding["category"]): number {
  let score = 100;
  for (const finding of findings.filter((f) => f.category === category)) {
    score -= finding.severity === "critical" ? 35 : finding.severity === "warning" ? 15 : 5;
  }
  return Math.max(0, score);
}

function selectChecks(checks: Check[], options: RunOptions): Check[] {
  const known = new Set(checks.map((c) => c.id));
  for (const id of [...(options.only ?? []), ...(options.skip ?? [])]) {
    if (!known.has(id)) {
      throw new Error(`Unknown check id "${id}". Available checks:\n  ${[...known].sort().join("\n  ")}`);
    }
  }
  let selected = checks;
  if (options.only?.length) selected = selected.filter((c) => options.only?.includes(c.id));
  if (options.skip?.length) selected = selected.filter((c) => !options.skip?.includes(c.id));
  return selected;
}

function applyOverrides(findings: Finding[], checks: Check[], engagement: Engagement | null): Finding[] {
  const overrides = engagement?.spec?.checks?.overrides ?? [];
  if (!overrides.length) return findings;

  const known = new Set(checks.map((c) => c.id));
  const byId = new Map<string, { severity: Severity; reason: string }>();
  for (const override of overrides) {
    if (!override.id || !known.has(override.id)) {
      throw new Error(
        `fde.yaml overrides an unknown check id "${override.id ?? ""}". Available checks:\n  ${[...known].sort().join("\n  ")}`
      );
    }
    if (!SEVERITIES.includes(override.severity as Severity)) {
      throw new Error(
        `fde.yaml override for "${override.id}" has invalid severity "${override.severity ?? ""}" (use critical, warning, or info).`
      );
    }
    if (!override.reason?.trim()) {
      throw new Error(
        `fde.yaml override for "${override.id}" is missing a reason. Overrides must document why the customer accepted the change.`
      );
    }
    byId.set(override.id, { severity: override.severity as Severity, reason: override.reason });
  }

  return findings.map((finding) => {
    const override = byId.get(finding.id);
    if (!override || override.severity === finding.severity) return finding;
    return {
      ...finding,
      severity: override.severity,
      evidence: [
        ...(finding.evidence ?? []),
        `fde.yaml: severity overridden from ${finding.severity} to ${override.severity} — ${override.reason}`
      ]
    };
  });
}

export async function runChecks(
  checks: Check[],
  context: CheckContext,
  options: RunOptions = {}
): Promise<CheckResult> {
  const findings: Finding[] = [];
  for (const check of selectChecks(checks, options)) {
    if (!check.appliesTo(context)) continue;
    findings.push(...(await check.run(context)));
  }

  const finalFindings = applyOverrides(findings, checks, context.engagement);

  const categories = ["security", "data", "reliability", "evaluation", "observability", "human_control"] as const;
  const scores = Object.fromEntries(
    categories.map((c) => [c, scoreFromFindings(finalFindings, c)])
  ) as CheckResult["scores"];
  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / categories.length);

  return { generatedAt: new Date().toISOString(), overallScore, scores, findings: finalFindings };
}
