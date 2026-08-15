import type { CheckResult, Finding, Inventory } from "../core/types.js";

function scoreFromFindings(findings: Finding[], category: Finding["category"]): number {
  let score = 100;
  for (const finding of findings.filter((f) => f.category === category)) {
    score -= finding.severity === "critical" ? 35 : finding.severity === "warning" ? 15 : 5;
  }
  return Math.max(0, score);
}

export function runDefaultChecks(inventory: Inventory, engagementText: string): CheckResult {
  const findings: Finding[] = [];
  const ids = new Set(inventory.components.map((c) => c.id));

  if (!/humanApproval|human_approval|requiredFor|required_for/i.test(engagementText)) {
    findings.push({
      id: "human-approval-undeclared",
      title: "Human approval boundary is not declared",
      severity: "warning",
      category: "human_control",
      explanation: "Side-effecting AI workflows should declare which actions require a human approval boundary.",
      recommendation: "Declare spec.constraints.humanApproval.requiredFor in fde.yaml."
    });
  }

  if (!/pii/i.test(engagementText)) {
    findings.push({
      id: "pii-policy-missing",
      title: "PII policy is not declared",
      severity: "critical",
      category: "data",
      explanation: "The engagement does not explicitly state how personally identifiable information may be handled.",
      recommendation: "Declare the PII boundary and whether external model providers are allowed."
    });
  }

  if (ids.has("openai") || ids.has("anthropic")) {
    if (!/allowExternalModel|externalModel|external_model/i.test(engagementText)) {
      findings.push({
        id: "external-model-policy-missing",
        title: "External model policy is undefined",
        severity: "warning",
        category: "security",
        explanation: "An external AI provider was detected but the engagement does not declare whether customer data may be sent to it.",
        evidence: [...ids].filter((id) => id === "openai" || id === "anthropic")
      });
    }
  }

  if (!ids.has("sentry") && !ids.has("opentelemetry")) {
    findings.push({
      id: "observability-missing",
      title: "No supported observability signal detected",
      severity: "warning",
      category: "observability",
      explanation: "OpenFDE did not detect Sentry or OpenTelemetry references in the scanned repository.",
      recommendation: "Add tracing/error monitoring or provide an observability plugin."
    });
  }

  if (!/eval/i.test(engagementText)) {
    findings.push({
      id: "evals-undeclared",
      title: "Regression evaluation is not declared",
      severity: "warning",
      category: "evaluation",
      explanation: "No evaluation requirement or eval artifact is declared for the engagement.",
      recommendation: "Define at least one task-success or regression evaluation before production."
    });
  }

  if (!/retry|fallback|timeout/i.test(engagementText)) {
    findings.push({
      id: "reliability-policy-missing",
      title: "Reliability controls are not declared",
      severity: "warning",
      category: "reliability",
      explanation: "Timeout, retry, or fallback expectations are not described in the engagement.",
      recommendation: "Declare reliability expectations for external dependencies and model calls."
    });
  }

  const categories = ["security", "data", "reliability", "evaluation", "observability", "human_control"] as const;
  const scores = Object.fromEntries(categories.map((c) => [c, scoreFromFindings(findings, c)])) as CheckResult["scores"];
  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / categories.length);

  return { generatedAt: new Date().toISOString(), overallScore, scores, findings };
}
