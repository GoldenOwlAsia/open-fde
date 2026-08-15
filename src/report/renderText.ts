import type { CheckResult, Finding, Inventory } from "../core/types.js";
import type { Engagement } from "../core/engagement.js";

const OPEN_QUESTIONS: Record<string, string> = {
  "external-model-policy-undefined": "May customer data be sent to an external model provider?",
  "pii-policy-undefined": "How must personally identifiable information be handled in this engagement?",
  "human-approval-undefined": "Which side-effecting actions require human approval before execution?",
  "observability-not-detected": "How will errors and traces be observed in the customer environment?",
  "evaluation-not-declared": "What evaluation must pass before this system reaches production?",
  "reliability-policy-absent": "What timeout, retry, and fallback behavior is expected for external calls?",
  "data-residency-violation": "Which regions may customer data and workloads run in?",
  "secrets-committed": "How should secrets be provisioned and rotated in this environment?",
  "write-boundary-violation": "Which systems may the deployment write to, and who approves widening that boundary?",
  "success-metrics-undeclared": "What measurable outcome defines success for this engagement?"
};

function renderFinding(finding: Finding): string {
  const evidence = finding.evidence?.length
    ? `\n**Evidence:**\n${finding.evidence.map((e) => `- ${e}`).join("\n")}\n`
    : "";
  const recommendation = finding.recommendation ? `\n**Recommendation:** ${finding.recommendation}\n` : "";
  return `### ${finding.title}\n\n${finding.explanation}\n${evidence}${recommendation}`;
}

export function renderMarkdownReport(
  inventory: Inventory,
  checks: CheckResult,
  engagement: Engagement | null
): string {
  const critical = checks.findings.filter((f) => f.severity === "critical");
  const warnings = checks.findings.filter((f) => f.severity === "warning");
  const questions = checks.findings
    .map((f) => OPEN_QUESTIONS[f.id])
    .filter((q): q is string => Boolean(q));

  const engagementSection = engagement
    ? [
        `- **Engagement:** ${engagement.metadata?.name ?? "unnamed"}`,
        `- **Customer:** ${engagement.spec?.customer?.name ?? "undeclared"}`,
        `- **Objective:** ${engagement.spec?.objective?.summary ?? "undeclared"}`,
        `- **Cloud:** ${engagement.spec?.environment?.cloud ?? "undeclared"}`
      ].join("\n")
    : "No `fde.yaml` engagement declaration was found. Run `fde init`.";

  return `# OpenFDE Deployment Report

Generated: ${checks.generatedAt}

## Engagement

${engagementSection}

## Readiness

**Overall: ${checks.overallScore}/100**

| Area | Score |
|---|---:|
${Object.entries(checks.scores)
  .map(([k, v]) => `| ${k.replaceAll("_", " ")} | ${v} |`)
  .join("\n")}

## Detected Environment

${inventory.components
  .map((c) => `- **${c.name}** — ${c.category} (${c.confidence} confidence; evidence: ${c.evidence.slice(0, 3).join(", ")})`)
  .join("\n") || "No components detected."}

## Critical Findings

${critical.map(renderFinding).join("\n") || "No critical findings."}

## Warnings

${warnings.map(renderFinding).join("\n") || "No warnings."}

## Open Questions

${questions.map((q) => `- ${q}`).join("\n") || "No open questions."}

## Architecture Map

- \`.fde/environment/integration-graph.json\`
- \`.fde/environment/integration-graph.mmd\`

## Suggested Next Actions

1. Resolve critical findings before production deployment.
2. Review the generated integration map with the customer technical owner.
3. Convert missing constraints into explicit entries in \`fde.yaml\`.
4. Add evidence for evaluation and observability before handoff.
`;
}
