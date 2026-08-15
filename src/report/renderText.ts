import type { CheckResult, Inventory } from "../core/types.js";

export function renderMarkdownReport(inventory: Inventory, checks: CheckResult): string {
  const critical = checks.findings.filter((f) => f.severity === "critical");
  const warnings = checks.findings.filter((f) => f.severity === "warning");

  return `# OpenFDE Deployment Report\n\nGenerated: ${checks.generatedAt}\n\n## Readiness\n\n**Overall: ${checks.overallScore}/100**\n\n| Area | Score |\n|---|---:|\n${Object.entries(checks.scores)
    .map(([k, v]) => `| ${k.replaceAll("_", " ")} | ${v} |`)
    .join("\n")}\n\n## Detected Environment\n\n${inventory.components
    .map((c) => `- **${c.name}** — ${c.category} (${c.confidence} confidence)`)
    .join("\n") || "No components detected."}\n\n## Critical Findings\n\n${critical
    .map((f) => `### ${f.title}\n\n${f.explanation}\n\n${f.recommendation ? `**Recommendation:** ${f.recommendation}\n` : ""}`)
    .join("\n") || "No critical findings."}\n\n## Warnings\n\n${warnings
    .map((f) => `### ${f.title}\n\n${f.explanation}\n\n${f.recommendation ? `**Recommendation:** ${f.recommendation}\n` : ""}`)
    .join("\n") || "No warnings."}\n\n## Suggested Next Actions\n\n1. Resolve critical findings before production deployment.\n2. Review the generated integration map with the customer technical owner.\n3. Convert missing constraints into explicit entries in \`fde.yaml\`.\n4. Add evidence for evaluation and observability before handoff.\n`;
}
